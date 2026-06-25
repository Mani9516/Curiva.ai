"""Pediatric disease categories and seed rows for disease_protocols."""

CHILD_DISEASE_CATEGORIES = [
    (
        "Common Childhood Illnesses",
        [
            "Common cold",
            "Flu (influenza)",
            "Viral fever",
            "Cough",
            "Sore throat",
            "Tonsillitis",
            "Ear infection (otitis media)",
            "Sinus infection",
            "Bronchitis",
            "Pneumonia",
            "Stomach flu / gastroenteritis",
            "Vomiting",
            "Diarrhea",
            "Food poisoning",
            "Conjunctivitis (pink eye)",
            "Mouth ulcers",
            "Hand, foot and mouth disease",
        ],
    ),
    (
        "Infectious / Contagious Childhood Diseases",
        [
            "Chickenpox",
            "Measles",
            "Mumps",
            "Rubella",
            "Whooping cough (pertussis)",
            "Diphtheria",
            "Polio",
            "Scarlet fever",
            "Tuberculosis (TB)",
            "COVID-19",
            "RSV infection",
            "Rotavirus infection",
            "Norovirus infection",
            "Impetigo",
            "Scabies",
            "Ringworm (fungal infection)",
        ],
    ),
    (
        "Fever-Related Illnesses in Children",
        [
            "Dengue",
            "Malaria",
            "Typhoid",
            "Pneumonia with fever",
            "Urinary tract infection with fever",
            "Meningitis",
            "Roseola",
            "Kawasaki disease",
        ],
    ),
    (
        "Stomach / Digestive Diseases in Children",
        [
            "Constipation",
            "Gastroenteritis",
            "Acid reflux / GERD",
            "Lactose intolerance",
            "Food allergy-related digestive issues",
            "Worm infestation",
            "Appendicitis",
            "Irritable bowel syndrome (IBS)",
            "Celiac disease",
            "Malabsorption syndrome",
            "Dehydration due to vomiting/diarrhea",
        ],
    ),
    (
        "Respiratory / Breathing Diseases in Children",
        [
            "Asthma",
            "Wheezing",
            "Bronchiolitis",
            "Bronchitis",
            "Sinusitis",
            "Allergic rhinitis",
            "Croup",
            "Sleep apnea",
            "Respiratory syncytial virus (RSV) infection",
        ],
    ),
    (
        "Skin Diseases in Children",
        [
            "Diaper rash",
            "Eczema (atopic dermatitis)",
            "Heat rash",
            "Hives (urticaria)",
            "Fungal infection",
            "Ringworm",
            "Warts",
            "Molluscum contagiosum",
            "Chickenpox rash",
            "Measles rash",
            "Psoriasis in children",
            "Acne in teenagers",
        ],
    ),
    (
        "Allergy & Immune Conditions in Children",
        [
            "Food allergy",
            "Milk allergy",
            "Egg allergy",
            "Peanut/nut allergy",
            "Dust allergy",
            "Pollen allergy",
            "Skin allergy",
            "Eczema linked to allergy",
            "Asthma linked to allergy",
            "Drug allergy",
            "Anaphylaxis",
        ],
    ),
    (
        "Nutritional & Deficiency Diseases in Children",
        [
            "Iron deficiency anemia",
            "Vitamin D deficiency",
            "Calcium deficiency",
            "Protein-energy malnutrition",
            "Underweight / failure to thrive",
            "Obesity in children",
            "Vitamin A deficiency",
            "Vitamin B12 deficiency",
            "Iodine deficiency disorders",
            "Rickets",
        ],
    ),
    (
        "Blood Disorders in Children",
        [
            "Anemia",
            "Thalassemia",
            "Sickle cell disease",
            "Hemophilia",
            "Leukemia",
            "Platelet disorders",
            "Aplastic anemia",
        ],
    ),
    (
        "Brain / Nervous System Disorders in Children",
        [
            "Febrile seizures",
            "Epilepsy",
            "Cerebral palsy",
            "Encephalitis",
            "Migraine in children",
            "Developmental delay",
            "Hydrocephalus",
            "Muscular dystrophy",
            "Neuromuscular disorders",
        ],
    ),
    (
        "Mental, Behavioral & Developmental Disorders in Children",
        [
            "Autism spectrum disorder (ASD)",
            "ADHD (attention-deficit/hyperactivity disorder)",
            "Speech delay",
            "Learning disability",
            "Dyslexia",
            "Intellectual disability",
            "Global developmental delay",
            "Anxiety disorder in children",
            "Depression in teenagers",
            "Behavioral disorders",
            "Oppositional defiant disorder (ODD)",
            "Sleep disorders in children",
        ],
    ),
    (
        "Bone, Growth & Hormonal Disorders in Children",
        [
            "Growth delay",
            "Short stature",
            "Delayed puberty",
            "Early puberty (precocious puberty)",
            "Thyroid disorders",
            "Growth hormone deficiency",
            "Obesity-related hormonal issues",
            "Scoliosis",
            "Flat feet / posture problems",
        ],
    ),
    (
        "Heart Diseases in Children",
        [
            "Congenital heart disease",
            "Heart murmur",
            "Rheumatic heart disease",
            "Kawasaki disease affecting the heart",
            "Arrhythmias in children",
            "Cardiomyopathy",
        ],
    ),
    (
        "Kidney & Urinary Diseases in Children",
        [
            "Urinary tract infection (UTI)",
            "Bedwetting (enuresis)",
            "Kidney infection",
            "Nephrotic syndrome",
            "Kidney stones",
            "Vesicoureteral reflux",
            "Dehydration-related urinary issues",
        ],
    ),
    (
        "Liver & Metabolic Diseases in Children",
        [
            "Jaundice in newborns",
            "Hepatitis A",
            "Hepatitis B",
            "Fatty liver (in obesity)",
            "Inborn errors of metabolism",
            "Wilson disease",
            "Glycogen storage disorders",
        ],
    ),
    (
        "Endocrine / Metabolic Diseases in Children",
        [
            "Type 1 diabetes",
            "Type 2 diabetes in obese adolescents",
            "Hypothyroidism",
            "Hyperthyroidism",
            "Adrenal disorders",
            "Obesity-related metabolic syndrome",
        ],
    ),
    (
        "Eye, Ear, Nose & Throat Diseases in Children",
        [
            "Lazy eye (amblyopia)",
            "Squint (strabismus)",
            "Refractive errors / vision problems",
            "Ear infection",
            "Hearing loss",
            "Adenoid enlargement",
            "Nosebleeds",
        ],
    ),
    (
        "Dental & Oral Problems in Children",
        [
            "Tooth decay / cavities",
            "Gum infection",
            "Teething problems",
            "Oral thrush",
            "Misaligned teeth",
        ],
    ),
    (
        "Newborn / Infant Diseases",
        [
            "Newborn jaundice",
            "Prematurity-related complications",
            "Low birth weight problems",
            "Neonatal sepsis",
            "Birth asphyxia complications",
            "Feeding difficulties",
            "Colic",
            "Reflux in infants",
            "Umbilical infection",
            "Thrush",
        ],
    ),
    (
        "Serious / Chronic Diseases in Children",
        [
            "Cancer in children (e.g., leukemia, lymphoma)",
            "Chronic kidney disease",
            "Autoimmune diseases",
            "Juvenile idiopathic arthritis",
            "Lupus in children",
        ],
    ),
]

_CATEGORY_META = {
    "Common Childhood Illnesses": {
        "specialist": "Pediatrician / Primary Care",
        "symptoms": "Fever, cough, nasal congestion, sore throat, ear pain, vomiting, diarrhea, rash, irritability, poor feeding, or reduced activity depending on the illness.",
        "treatment": "Supportive care (fluids, rest, fever control), age-appropriate medications as prescribed, isolation when contagious, and follow-up if symptoms worsen or persist beyond expected duration.",
        "diet_notes": "Encourage frequent small feeds, oral rehydration for gastro illnesses, soft foods during sore throat, and adequate fluids during fever.",
        "medications": "Paracetamol or ibuprofen (per weight-based dosing), saline nasal drops, prescribed antibiotics only when bacterial infection is confirmed.",
        "lifestyle": "Hand hygiene, vaccination on schedule, keep child home while febrile or contagious, monitor hydration and wet diapers/urination.",
    },
    "Infectious / Contagious Childhood Diseases": {
        "specialist": "Pediatrician / Pediatric Infectious Disease",
        "symptoms": "Fever, rash, cough, lymph node swelling, conjunctivitis, or skin lesions; incubation and contagious periods vary by pathogen.",
        "treatment": "Vaccine-preventable illnesses managed per public-health guidance; supportive care; antivirals or antibiotics when indicated; notify school/daycare per policy.",
        "diet_notes": "Hydration priority; bland diet during acute illness; avoid sharing utensils; breastfeed if infant unless contraindicated.",
        "medications": "Condition-specific: antipyretics, acyclovir for select cases, antibiotics for bacterial superinfection, topical antifungals for ringworm.",
        "lifestyle": "Stay up to date on immunizations, isolate during contagious phase, teach cough etiquette, disinfect high-touch surfaces.",
    },
    "Fever-Related Illnesses in Children": {
        "specialist": "Pediatrician / Emergency Medicine",
        "symptoms": "High or prolonged fever, lethargy, neck stiffness, rash, poor urine output, breathing difficulty, or refusal to drink — red flags need urgent review.",
        "treatment": "Identify and treat underlying cause; antipyretics for comfort; hospital care if sepsis, dehydration, or meningitis suspected.",
        "diet_notes": "Oral rehydration solution during fever; resume normal diet as tolerated; small frequent feeds for infants.",
        "medications": "Weight-based paracetamol/ibuprofen; disease-specific therapy (e.g., antimalarials, antibiotics for typhoid) per pediatrician.",
        "lifestyle": "Monitor temperature every 4–6 hours, tepid sponging if advised, seek emergency care for toxic appearance or persistent fever >72h in young infants.",
    },
    "Stomach / Digestive Diseases in Children": {
        "specialist": "Pediatrician / Pediatric Gastroenterologist",
        "symptoms": "Abdominal pain, vomiting, diarrhea, constipation, bloating, poor growth, blood in stool, or feeding refusal.",
        "treatment": "Rehydration, dietary modification, treat infection or inflammation, surgical referral for appendicitis or complications.",
        "diet_notes": "BRAT or bland foods during acute gastro; gluten-free for confirmed celiac; lactose-free trial if intolerance suspected; high-fiber for constipation.",
        "medications": "ORS, probiotics (selected cases), antiemetics/antispasmodics per age, antibiotics only if indicated, PPI for GERD when prescribed.",
        "lifestyle": "Regular meal times, toilet training support, hygiene for worm prevention, weight tracking for failure to thrive.",
    },
    "Respiratory / Breathing Diseases in Children": {
        "specialist": "Pediatrician / Pediatric Pulmonologist",
        "symptoms": "Cough, wheeze, chest retractions, fast breathing, noisy breathing (stridor in croup), night symptoms, or exercise limitation.",
        "treatment": "Bronchodilators for asthma/wheeze, nebulized epinephrine or steroids for croup, oxygen if hypoxic, treat underlying infection.",
        "diet_notes": "Avoid known trigger foods if allergy-related; adequate hydration; no food restrictions unless aspiration risk.",
        "medications": "Salbutamol inhaler/spacer, inhaled corticosteroids for persistent asthma, oral steroids short courses, antibiotics if bacterial pneumonia.",
        "lifestyle": "Avoid smoke exposure, use action plan for asthma, influenza/RSV precautions in infancy, sleep positioning per apnea workup.",
    },
    "Skin Diseases in Children": {
        "specialist": "Pediatrician / Pediatric Dermatologist",
        "symptoms": "Rash, itching, redness, blisters, scaling, or skin infection; distribution often age-specific (diaper area, flexures, face).",
        "treatment": "Emollients for eczema, topical steroids short-term as directed, antifungals/antibiotics for infection, cool compresses for hives.",
        "diet_notes": "Elimination diet only under specialist guidance for severe eczema/food-linked rash; otherwise balanced child diet.",
        "medications": "Topical emollients, low-potency topical steroids, antihistamines for itch, topical clotrimazole, imiquimod or cryotherapy for warts per age.",
        "lifestyle": "Gentle fragrance-free skin care, frequent diaper changes, cotton clothing, sun protection, avoid scratching.",
    },
    "Allergy & Immune Conditions in Children": {
        "specialist": "Pediatric Allergist / Immunologist",
        "symptoms": "Hives, swelling, vomiting after food, wheeze, eczema flares, rhinitis, or anaphylaxis (difficulty breathing, hypotension).",
        "treatment": "Allergen avoidance, action plan with epinephrine auto-injector for anaphylaxis, immunotherapy in selected cases, treat comorbid asthma/eczema.",
        "diet_notes": "Strict avoidance of confirmed allergens; read labels; introduce solids per guideline; nutritional support if multiple restrictions.",
        "medications": "Epinephrine auto-injector, cetirizine/loratadine, intranasal steroids, adrenaline for anaphylaxis — emergency protocol required.",
        "lifestyle": "Allergy action plan at school, medical ID bracelet, train caregivers on epinephrine use, carry rescue medications.",
    },
    "Nutritional & Deficiency Diseases in Children": {
        "specialist": "Pediatrician / Pediatric Nutritionist",
        "symptoms": "Poor growth, fatigue, pale skin, bowed legs, frequent infections, obesity, or developmental concerns linked to nutrition.",
        "treatment": "Correct deficiency with supplements and diet; treat underlying cause; growth monitoring; multidisciplinary care for obesity.",
        "diet_notes": "Iron-rich foods (leafy greens, lentils, fortified cereals), vitamin D and calcium sources, balanced macros, limit sugary drinks.",
        "medications": "Iron supplements, vitamin D3, multivitamins as needed, vitamin A for deficiency per WHO protocols in endemic areas.",
        "lifestyle": "Regular growth charting, outdoor activity for vitamin D, structured meals, limit screen time, physical activity for healthy weight.",
    },
    "Blood Disorders in Children": {
        "specialist": "Pediatric Hematologist",
        "symptoms": "Pallor, easy bruising, bleeding, bone pain, recurrent infections, or enlarged liver/spleen depending on disorder.",
        "treatment": "Transfusions, chelation, factor replacement, chemotherapy protocols for leukemia — all under hematology-oncology care.",
        "diet_notes": "Iron-rich diet for anemia; avoid iron overload in thalassemia; infection-safe food handling during neutropenia.",
        "medications": "Iron, folic acid, hydroxyurea (sickle cell), factor VIII/IX, chemotherapy regimens per protocol — specialist only.",
        "lifestyle": "Infection prevention, genetic counseling for inherited disorders, school accommodations, regular blood counts.",
    },
    "Brain / Nervous System Disorders in Children": {
        "specialist": "Pediatric Neurologist",
        "symptoms": "Seizures, developmental delay, weakness, headache, altered consciousness, or abnormal movements.",
        "treatment": "Antiepileptics, acute meningitis/encephalitis protocols, physiotherapy for cerebral palsy, shunting for hydrocephalus.",
        "diet_notes": "Ketogenic diet in selected epilepsy (specialist supervised); adequate hydration; swallowing-safe textures if needed.",
        "medications": "Anticonvulsants (e.g., levetiracetam, valproate per age), IV antibiotics for CNS infection in hospital setting.",
        "lifestyle": "Seizure safety precautions, early intervention therapies, helmet use if falls, regular neurology follow-up.",
    },
    "Mental, Behavioral & Developmental Disorders in Children": {
        "specialist": "Child Psychiatrist / Developmental Pediatrician",
        "symptoms": "Inattention, hyperactivity, social communication differences, learning struggles, mood changes, or disruptive behavior.",
        "treatment": "Behavioral therapy, school supports (IEP/504), parent training, medication when appropriate for ADHD/anxiety/depression.",
        "diet_notes": "Regular meals for mood stability; limit caffeine in teens; no special diet cures ASD — address selective eating with OT/dietitian.",
        "medications": "Methylphenidate/atomoxetine for ADHD, SSRIs for adolescent depression/anxiety under close monitoring.",
        "lifestyle": "Consistent routines, sleep hygiene, screen limits, therapy engagement, family psychoeducation.",
    },
    "Bone, Growth & Hormonal Disorders in Children": {
        "specialist": "Pediatric Endocrinologist / Pediatric Orthopedist",
        "symptoms": "Short stature, delayed or early puberty, gait changes, spinal curvature, or hormonal symptoms (fatigue, weight change).",
        "treatment": "Growth hormone when indicated, thyroid replacement, puberty blockers or triggers per guidelines, bracing for scoliosis.",
        "diet_notes": "Adequate protein, calcium, vitamin D; balanced calories for growth; address obesity to reduce hormonal complications.",
        "medications": "Levothyroxine, growth hormone injections, GnRH analogs — endocrinology supervised.",
        "lifestyle": "Growth velocity monitoring, posture exercises, supportive footwear, weight management programs.",
    },
    "Heart Diseases in Children": {
        "specialist": "Pediatric Cardiologist",
        "symptoms": "Cyanosis, poor feeding, fast breathing, fatigue on exertion, murmur, or chest pain in older children.",
        "treatment": "Medical management, catheter intervention, or surgery for congenital lesions; rheumatic fever prophylaxis; Kawasaki IVIG.",
        "diet_notes": "Heart-healthy diet if obesity comorbidity; sodium moderation in heart failure; adequate calories for infants with CHD.",
        "medications": "Diuretics, ACE inhibitors, beta-blockers, aspirin/IVIG for Kawasaki — cardiology directed.",
        "lifestyle": "Activity restrictions per lesion severity, endocarditis prophylaxis when indicated, regular echocardiography.",
    },
    "Kidney & Urinary Diseases in Children": {
        "specialist": "Pediatric Nephrologist / Pediatric Urologist",
        "symptoms": "Burning urination, fever with UTI, bedwetting beyond expected age, swelling, blood in urine, or flank pain.",
        "treatment": "Antibiotics for UTI, voiding schedules for enuresis, treat reflux/nephrotic syndrome per protocol, hydration for stones.",
        "diet_notes": "Adequate fluids; salt restriction in nephrotic edema; limit oxalate-rich foods if stone-forming tendency (specialist advice).",
        "medications": "Antibiotics per culture, desmopressin for enuresis, steroids for nephrotic syndrome under nephrology care.",
        "lifestyle": "Timed voiding, treat constipation (contributes to UTI), night dryness training, monitor blood pressure in kidney disease.",
    },
    "Liver & Metabolic Diseases in Children": {
        "specialist": "Pediatric Hepatologist / Metabolic Geneticist",
        "symptoms": "Jaundice, poor feeding, hepatomegaly, hypoglycemia, developmental regression, or acute metabolic crisis.",
        "treatment": "Phototherapy for neonatal jaundice, antivirals/support for hepatitis, dietary therapy for inborn errors, chelation for Wilson disease.",
        "diet_notes": "Special metabolic formulas when required; avoid fasting in metabolic disorders; low copper diet in Wilson disease.",
        "medications": "Ursodeoxycholic acid, antivirals, enzyme/cofactor replacement, penicillamine for Wilson — specialist only.",
        "lifestyle": "Newborn screening follow-up, emergency sick-day plan for metabolic patients, vaccination per schedule.",
    },
    "Endocrine / Metabolic Diseases in Children": {
        "specialist": "Pediatric Endocrinologist",
        "symptoms": "Polyuria, polydipsia, weight change, fatigue, goiter, or signs of adrenal insufficiency.",
        "treatment": "Insulin for type 1 diabetes, lifestyle + metformin sometimes in type 2 teens, thyroid hormone replacement, adrenal steroids.",
        "diet_notes": "Carbohydrate counting for diabetes; balanced diet for metabolic syndrome; consistent meal timing with insulin.",
        "medications": "Insulin regimens, metformin, levothyroxine, hydrocortisone/fludrocortisone for adrenal disorders.",
        "lifestyle": "Glucose monitoring, HbA1c targets, physical activity, diabetes education, school nurse coordination.",
    },
    "Eye, Ear, Nose & Throat Diseases in Children": {
        "specialist": "Pediatric Ophthalmologist / Pediatric ENT",
        "symptoms": "Red eye, vision complaints, ear tugging, hearing difficulty, snoring, mouth breathing, or recurrent nosebleeds.",
        "treatment": "Glasses for refractive error, patching for amblyopia, antibiotics for otitis, adenotonsillectomy when indicated.",
        "diet_notes": "No specific diet; soft foods post-tonsil surgery; hydration during upper respiratory infections.",
        "medications": "Antibiotic ear drops/oral antibiotics, antihistamines, nasal saline, atropine/patching regimen for amblyopia.",
        "lifestyle": "Limit screen time strain, hearing screening, noise protection, humidifier for dry air, avoid nose picking.",
    },
    "Dental & Oral Problems in Children": {
        "specialist": "Pediatric Dentist",
        "symptoms": "Tooth pain, cavities, gum bleeding, teething irritability, white patches in mouth, or crooked teeth.",
        "treatment": "Fluoride varnish, fillings, pulpotomy, orthodontics referral, antifungals for thrush, teething rings/analgesia.",
        "diet_notes": "Limit sugary snacks/drinks, avoid bottle at bedtime, encourage water, calcium-rich foods for enamel.",
        "medications": "Topical fluoride, nystatin for thrush, paracetamol for teething pain, antibiotics only for dental abscess.",
        "lifestyle": "Brush twice daily with fluoride toothpaste (rice-grain/pea size by age), first dental visit by age 1, mouthguards in sports.",
    },
    "Newborn / Infant Diseases": {
        "specialist": "Neonatologist / Pediatrician",
        "symptoms": "Jaundice, poor feeding, lethargy, vomiting, umbilical redness, excessive crying, or breathing difficulty in first months.",
        "treatment": "Phototherapy, NICU care for prematurity, sepsis workup, feeding support, umbilical care, colic reassurance strategies.",
        "diet_notes": "Exclusive breastfeeding when possible; correct latch; small frequent feeds for reflux; formula change only per clinician.",
        "medications": "Phototherapy, IV antibiotics for sepsis, vitamin K at birth, oral nystatin for thrush.",
        "lifestyle": "Safe sleep (back to sleep), umbilical hygiene, kangaroo care for preemies, watch for dehydration signs.",
    },
    "Serious / Chronic Diseases in Children": {
        "specialist": "Pediatric Oncologist / Pediatric Subspecialist",
        "symptoms": "Persistent fever, weight loss, pallor, joint swelling, rash, or organ-specific chronic symptoms requiring long-term care.",
        "treatment": "Multidisciplinary oncology, rheumatology, or nephrology care; chemotherapy, biologics, dialysis/transplant when needed.",
        "diet_notes": "Nutrition support during cancer therapy; anti-inflammatory diet adjunct only — primary treatment is medical.",
        "medications": "Chemotherapy protocols, biologic DMARDs for JIA, immunosuppression for lupus — hospital/specialist managed.",
        "lifestyle": "School reintegration plans, infection precautions during chemotherapy, psychosocial support for child and family.",
    },
}

_DEFAULT_META = _CATEGORY_META["Common Childhood Illnesses"]


def _category_label(category: str) -> str:
    return f"Children's Health — {category}"


def _build_protocol(name: str, category: str) -> tuple:
    meta = _CATEGORY_META.get(category, _DEFAULT_META)
    overview = (
        f"{name} is a pediatric condition classified under {category.lower()}. "
        f"It may present differently by age (newborn, infant, child, or adolescent). "
        "Early recognition, age-appropriate treatment, and caregiver education improve outcomes."
    )
    return (
        name,
        _category_label(category),
        overview,
        meta["symptoms"],
        f"Clinical management of {name}: {meta['treatment']}",
        meta["diet_notes"],
        meta["medications"],
        meta["lifestyle"],
        meta["specialist"],
    )


def child_disease_protocol_rows() -> list[tuple]:
    """Return unique disease_protocols insert rows for all listed childhood conditions."""
    seen: set[str] = set()
    rows: list[tuple] = []
    for category, diseases in CHILD_DISEASE_CATEGORIES:
        for name in diseases:
            key = name.strip().lower()
            if key in seen:
                continue
            seen.add(key)
            rows.append(_build_protocol(name.strip(), category))
    return rows


def child_disease_category_labels() -> list[str]:
    return [_category_label(cat) for cat, _ in CHILD_DISEASE_CATEGORIES]
