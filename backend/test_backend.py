import os
import sys

# Add backend directory to PYTHONPATH
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__))))

from app.db import init_db, get_db_conn
from app.agents.orchestrator import WorkflowOrchestrator
from app.rag.rag_service import RAGService
from app.rl.agent import QLearningAgent

def test_system():
    print("=== STARTING DIAGNOSTIC VERIFICATION ===")
    
    # 1. DB Init
    print("\n[1/4] Verifying Database Setup...")
    init_db()
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print("Created SQLite tables:", tables)
    assert "patients" in tables, "patients table missing!"
    assert "rl_metrics" in tables, "rl_metrics table missing!"
    conn.close()
    print("Database verified successfully.")
    
    # 2. Agent Intake Pipeline
    print("\n[2/4] Verifying Agent Intake Pipeline...")
    orchestrator = WorkflowOrchestrator()
    result = orchestrator.run_intake_pipeline(
        name="Jane Smith",
        age=29,
        gender="Female",
        symptoms="Severe lower abdominal pain, migrating from belly button, nausea",
        notes="Suspected appendicitis based on symptoms. Scheduled diagnostic ultrasound."
    )
    print("Intake Pipeline executed. Success:", result["success"])
    assert result["success"], "Pipeline failed!"
    print("Pipeline steps:")
    for step in result["steps"]:
        print(f" - [{step['agent']}] (Success: {step['success']}): {step['log'][:90]}...")
    
    # Check DB update
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT severity, status FROM patients WHERE id=?", (result["patient_id"],))
    patient = cursor.fetchone()
    print("Patient status in DB:", dict(patient) if patient else None)
    assert patient["severity"] == "Urgent", "Wrong severity assignment!"
    conn.close()
    print("Agent Pipeline verified successfully.")
    
    # 3. RAG Search Engine
    print("\n[3/4] Verifying RAG Search Engine...")
    rag = RAGService()
    rag_res = rag.answer_query("How do you treat acute appendicitis?")
    print("RAG Answer:", rag_res["answer"])
    print("Citations:")
    for c in rag_res["citations"]:
        print(f" - Source: {c['source']} (Relevance: {c['relevance']})")
    assert len(rag_res["citations"]) > 0, "No citations found!"
    print("RAG System verified successfully.")
    
    # 4. RL Queue Optimizer
    print("\n[4/4] Verifying RL Environment & Agent...")
    agent = QLearningAgent()
    print("Running short training cycle (20 episodes)...")
    history = agent.train(episodes=20)
    print("Agent trained. Ep 20 reward:", history[-1]["reward"])
    
    print("Evaluating policies...")
    comparison = agent.evaluate_policies(num_episodes=5)
    for policy, metrics in comparison.items():
        print(f" - {policy}: Avg Wait = {metrics['avg_wait']:.2f}, Emergency Queue = {metrics['emergency_wait']:.2f}")
    assert "RL_Optimized" in comparison, "Evaluation missing RL policy!"
    print("RL Optimizer verified successfully.")
    
    print("\n=== ALL DIAGNOSTICS COMPLETED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_system()
