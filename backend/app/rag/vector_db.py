import math
import re
from typing import List, Dict, Tuple

class SimpleVectorDB:
    def __init__(self):
        self.chunks: List[Dict] = []  # List of {"doc_name": str, "text": str}
        self.vocab: List[str] = []
        self.idf: Dict[str, float] = {}
        self.vectors: List[List[float]] = []

    def _tokenize(self, text: str) -> List[str]:
        # Lowercase and split on non-alphanumeric words
        words = re.findall(r'\b\w+\b', text.lower())
        # Remove small stop words for better search quality
        stopwords = {"the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "for", "with", "in", "on", "at", "by", "is", "are", "was", "were", "it"}
        return [w for w in words if w not in stopwords]

    def add_documents(self, documents: List[Dict[str, str]]):
        """
        documents: List of {"name": str, "content": str}
        """
        self.chunks = []
        for doc in documents:
            name = doc["name"]
            content = doc["content"]
            # Split content into paragraph/sentence chunks
            paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
            for p in paragraphs:
                self.chunks.append({
                    "doc_name": name,
                    "text": p
                })
        
        self._build_index()

    def _build_index(self):
        if not self.chunks:
            return

        # 1. Build Vocabulary
        all_tokenized = [self._tokenize(chunk["text"]) for chunk in self.chunks]
        vocab_set = set()
        for tokens in all_tokenized:
            vocab_set.update(tokens)
        self.vocab = sorted(list(vocab_set))
        vocab_index = {word: i for i, word in enumerate(self.vocab)}

        # 2. Calculate IDF
        num_docs = len(self.chunks)
        doc_counts = {word: 0 for word in self.vocab}
        for tokens in all_tokenized:
            unique_tokens = set(tokens)
            for token in unique_tokens:
                if token in doc_counts:
                    doc_counts[token] += 1

        self.idf = {}
        for word, count in doc_counts.items():
            # Standard IDF with smoothing
            self.idf[word] = math.log(1 + (num_docs / (count + 1)))

        # 3. Calculate TF-IDF vectors for all documents
        self.vectors = []
        for tokens in all_tokenized:
            vector = [0.0] * len(self.vocab)
            if not tokens:
                self.vectors.append(vector)
                continue
            
            # TF
            tf = {}
            for token in tokens:
                tf[token] = tf.get(token, 0) + 1
            
            # TF-IDF
            for token, count in tf.items():
                if token in vocab_index:
                    idx = vocab_index[token]
                    vector[idx] = (count / len(tokens)) * self.idf[token]
            
            # Normalize vector (L2 norm)
            norm = math.sqrt(sum(val ** 2 for val in vector))
            if norm > 0:
                vector = [val / norm for val in vector]
                
            self.vectors.append(vector)

    def search(self, query: str, top_k: int = 3) -> List[Tuple[Dict, float]]:
        if not self.vectors or not self.vocab:
            return []

        query_tokens = self._tokenize(query)
        vocab_index = {word: i for i, word in enumerate(self.vocab)}

        # Vectorize query
        query_vector = [0.0] * len(self.vocab)
        if not query_tokens:
            return []

        # TF
        q_tf = {}
        for token in query_tokens:
            q_tf[token] = q_tf.get(token, 0) + 1
        
        # TF-IDF
        for token, count in q_tf.items():
            if token in vocab_index:
                idx = vocab_index[token]
                query_vector[idx] = (count / len(query_tokens)) * self.idf[token]

        # Normalize query vector
        q_norm = math.sqrt(sum(val ** 2 for val in query_vector))
        if q_norm > 0:
            query_vector = [val / q_norm for val in query_vector]
        else:
            return []

        # Cosine Similarity
        results = []
        for i, doc_vector in enumerate(self.vectors):
            dot_product = sum(query_vector[j] * doc_vector[j] for j in range(len(self.vocab)))
            if dot_product > 0.05:  # Similarity threshold
                results.append((self.chunks[i], dot_product))

        # Sort by similarity descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

if __name__ == "__main__":
    db = SimpleVectorDB()
    db.add_documents([
        {
            "name": "Pneumonia Guideline",
            "content": "Pneumonia is an infection that inflames the air sacs in one or both lungs. Symptoms include cough, fever, chills, and difficulty breathing. Treatment includes antibiotics and rest. High risk patients include infants and elderly."
        },
        {
            "name": "Appendicitis Guideline",
            "content": "Appendicitis is an inflammation of the appendix. It causes severe pain in the lower right abdomen, nausea, and fever. Diagnostic confirmation is done via CT scan or ultrasound. Emergency appendectomy is the primary treatment."
        }
    ])
    
    matches = db.search("abdominal pain and fever")
    for chunk, score in matches:
        print(f"[{chunk['doc_name']}] (Score: {score:.3f}): {chunk['text']}")
