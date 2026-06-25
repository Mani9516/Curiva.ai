import sqlite3
import os
import hashlib
import json
import random
import secrets
from datetime import datetime

from app.indian_doctors import DEFAULT_DOCTOR_DISPLAY_NAME, migrate_legacy_doctor_names
from app.child_diseases import child_disease_protocol_rows

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mediflow.db")

def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Required so ON DELETE CASCADE / SET NULL on patient-related tables are enforced.
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


def new_patient_qr_token() -> str:
    """Unique opaque token encoded in patient QR cards (MF- prefix + 16 hex chars)."""
    return f"MF-{secrets.token_hex(8).upper()}"


def _patient_activity_score(cursor, patient_id: int) -> int:
    if not patient_id:
        return 0
    score = 0
    for table in (
        "appointments",
        "patient_test_reports",
        "imaging_scans",
        "health_vitals",
        "diet_plans",
    ):
        cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE patient_id = ?", (patient_id,))
        score += int(cursor.fetchone()[0] or 0)
    cursor.execute(
        """
        SELECT COUNT(*) FROM payments p
        JOIN users u ON u.id = p.user_id
        WHERE u.patient_id = ?
        """,
        (patient_id,),
    )
    score += int(cursor.fetchone()[0] or 0)
    return score


def _is_heal_stub_patient(cursor, patient_id: int) -> bool:
    cursor.execute("SELECT symptoms FROM patients WHERE id = ?", (patient_id,))
    row = cursor.fetchone()
    if not row:
        return False
    sym = (row["symptoms"] or "").lower()
    return "re-linked after database maintenance" in sym or "portal activation" in sym


def _find_existing_patient_for_portal_user(cursor, name: str, site_city, site_hospital):
    name_key = (name or "").strip().lower()
    if not name_key:
        return None
    sc = (site_city or "").strip() or None
    sh = (site_hospital or "").strip() or None
    candidates = []

    if sc and sh:
        cursor.execute(
            """
            SELECT p.id FROM patients p
            LEFT JOIN users u ON u.patient_id = p.id
            WHERE LOWER(TRIM(p.name)) = ? AND p.site_city = ? AND p.site_hospital = ?
            GROUP BY p.id
            ORDER BY p.id DESC
            """,
            (name_key, sc, sh),
        )
        candidates.extend(row[0] for row in cursor.fetchall())

    cursor.execute(
        """
        SELECT p.id FROM patients p
        WHERE LOWER(TRIM(p.name)) = ?
        ORDER BY p.id DESC
        """,
        (name_key,),
    )
    for row in cursor.fetchall():
        if row[0] not in candidates:
            candidates.append(row[0])

    if not candidates:
        return None

  # Prefer the chart with the most clinical/billing activity.
    return max(candidates, key=lambda pid: _patient_activity_score(cursor, pid))


def repair_patient_user_links(cursor) -> None:
    """Clear stale patient_id values, re-link demo users, and restore EHR rows for approved portal accounts."""
    cursor.execute(
        """
        UPDATE users SET patient_id = NULL
        WHERE patient_id IS NOT NULL
          AND patient_id NOT IN (SELECT id FROM patients)
        """
    )
    for username, pname in (("patient1", "Priya Kapoor"), ("patient2", "Sneha Rao")):
        cursor.execute("SELECT id FROM patients WHERE name = ? ORDER BY id LIMIT 1", (pname,))
        row = cursor.fetchone()
        if row:
            cursor.execute(
                "UPDATE users SET patient_id = ? WHERE LOWER(username) = ?",
                (row[0], username.lower()),
            )

    cursor.execute(
        """
        SELECT id, full_name, username, site_city, site_hospital
        FROM users
        WHERE role = 'patient'
          AND patient_id IS NULL
          AND COALESCE(approval_status, 'approved') = 'approved'
        """
    )
    for row in cursor.fetchall():
        uid = row["id"]
        name = (row["full_name"] or row["username"] or "Patient").strip()
        existing = _find_existing_patient_for_portal_user(
            cursor, name, row["site_city"], row["site_hospital"]
        )
        if existing and _patient_activity_score(cursor, existing) > 0:
            cursor.execute("UPDATE users SET patient_id = ? WHERE id = ?", (existing, uid))
            continue

        now = datetime.now().isoformat()
        sc = (row["site_city"] or "").strip() or None
        sh = (row["site_hospital"] or "").strip() or None
        age = random.randint(22, 68)
        gender = random.choice(["Female", "Male", "Other"])
        cursor.execute(
            """
            INSERT INTO patients (name, age, gender, symptoms, severity, status, created_at, site_city, site_hospital, qr_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                age,
                gender,
                "Portal account re-linked after database maintenance.",
                "Medium",
                "Approved_Portal",
                now,
                sc,
                sh,
                new_patient_qr_token(),
            ),
        )
        pid = cursor.lastrowid
        cursor.execute(
            """
            INSERT OR REPLACE INTO clinical_summaries (patient_id, summary, diagnoses, risk_score, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                pid,
                f"{name} — EHR re-established for Curiva portal access.",
                "Health maintenance",
                25,
                now,
            ),
        )
        cursor.execute("UPDATE users SET patient_id = ? WHERE id = ?", (pid, uid))

    # Users stuck on empty auto-healed charts → richer chart with the same name.
    cursor.execute(
        """
        SELECT u.id AS user_id, u.patient_id, u.full_name
        FROM users u
        JOIN patients p ON p.id = u.patient_id
        WHERE u.role = 'patient' AND u.patient_id IS NOT NULL
        """
    )
    for row in cursor.fetchall():
        pid = row["patient_id"]
        if not _is_heal_stub_patient(cursor, pid):
            continue
        if _patient_activity_score(cursor, pid) > 0:
            continue
        name = (row["full_name"] or "").strip()
        better = _find_existing_patient_for_portal_user(cursor, name, None, None)
        if not better or better == pid or _patient_activity_score(cursor, better) == 0:
            continue
        cursor.execute("UPDATE users SET patient_id = ? WHERE id = ?", (better, row["user_id"]))
        cursor.execute("SELECT COUNT(*) FROM users WHERE patient_id = ?", (pid,))
        if int(cursor.fetchone()[0] or 0) == 0:
            cursor.execute("DELETE FROM patients WHERE id = ?", (pid,))


def init_db():
    conn = get_db_conn()
    cursor = conn.cursor()

    # 1. Users (auth)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'patient',
        full_name TEXT,
        email TEXT,
        patient_id INTEGER,
        site_city TEXT,
        site_hospital TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # 2. Patients
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        symptoms TEXT,
        severity TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Intake',
        created_at TEXT NOT NULL
    )
    """)

    # 3. Clinical Summaries
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clinical_summaries (
        patient_id INTEGER PRIMARY KEY,
        summary TEXT,
        diagnoses TEXT,
        risk_score INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
    """)

    # 4. Imaging Scans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS imaging_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        scan_type TEXT,
        priority TEXT,
        assigned_radiologist TEXT,
        scheduled_time TEXT,
        status TEXT DEFAULT 'Pending',
        report_findings TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
    """)

    # 4b. Outpatient appointments (patient schedule; demo seed)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        care_team TEXT,
        location TEXT,
        scheduled_at TEXT NOT NULL,
        status TEXT DEFAULT 'Scheduled',
        notes TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
    """)

    # 4c. Lab / pathology test reports & bookings (shown in patient "My records")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patient_test_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        lab_name TEXT,
        items_json TEXT,
        scheduled_at TEXT,
        status TEXT DEFAULT 'Scheduled',
        result_summary TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
    """)

    # 5. Tasks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assigned_to TEXT NOT NULL,
        task_type TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        details TEXT,
        patient_id INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
    )
    """)

    # 6. Alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        level TEXT DEFAULT 'Info',
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
    )
    """)

    # 7. RL Metrics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rl_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode INTEGER,
        average_waiting_time REAL,
        resource_utilization REAL,
        reward REAL,
        timestamp TEXT NOT NULL
    )
    """)

    # 8. Health Vitals (real-time monitoring)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS health_vitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        heart_rate INTEGER,
        systolic_bp INTEGER,
        diastolic_bp INTEGER,
        spo2 REAL,
        temperature REAL,
        blood_sugar REAL,
        bmi REAL,
        weight REAL,
        height REAL,
        status TEXT DEFAULT 'Normal',
        recorded_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
    """)

    # 9. Diet Plans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS diet_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        condition TEXT,
        plan_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
    """)

    # 10. Disease Protocols
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS disease_protocols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category TEXT,
        overview TEXT,
        symptoms TEXT,
        treatment TEXT,
        diet_notes TEXT,
        medications TEXT,
        lifestyle TEXT,
        specialist TEXT
    )
    """)

    # 11. Payments (billing — demo gateway; no real card processor)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount_inr REAL NOT NULL,
        description TEXT NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        reference_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # ── Schema migrations (existing SQLite files) ───────────────────────────
    cursor.execute("PRAGMA table_info(imaging_scans)")
    _imaging_cols = {row[1] for row in cursor.fetchall()}
    if _imaging_cols and "report_findings" not in _imaging_cols:
        cursor.execute("ALTER TABLE imaging_scans ADD COLUMN report_findings TEXT")

    cursor.execute("PRAGMA table_info(patients)")
    _patient_cols = {row[1] for row in cursor.fetchall()}
    if "primary_care_doctor_id" not in _patient_cols:
        cursor.execute("ALTER TABLE patients ADD COLUMN primary_care_doctor_id INTEGER")
    if "site_city" not in _patient_cols:
        cursor.execute("ALTER TABLE patients ADD COLUMN site_city TEXT")
    if "site_hospital" not in _patient_cols:
        cursor.execute("ALTER TABLE patients ADD COLUMN site_hospital TEXT")
    if "qr_token" not in _patient_cols:
        cursor.execute("ALTER TABLE patients ADD COLUMN qr_token TEXT")

    cursor.execute("SELECT id FROM patients WHERE qr_token IS NULL OR TRIM(qr_token) = ''")
    for (pid,) in cursor.fetchall():
        cursor.execute(
            "UPDATE patients SET qr_token = ? WHERE id = ?",
            (new_patient_qr_token(), pid),
        )
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_qr_token ON patients(qr_token) WHERE qr_token IS NOT NULL"
    )

    cursor.execute("PRAGMA table_info(users)")
    _user_cols = {row[1] for row in cursor.fetchall()}
    if _user_cols:
        if "site_city" not in _user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN site_city TEXT")
        if "site_hospital" not in _user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN site_hospital TEXT")
        if "approval_status" not in _user_cols:
            cursor.execute(
                "ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'"
            )

    # Repair NULL / empty / literal "undefined" display names (UI + exports)
    migrate_legacy_doctor_names(cursor)
    cursor.execute(
        """
        UPDATE users SET full_name = TRIM(username)
        WHERE role NOT IN ('doctor')
          AND (full_name IS NULL OR TRIM(full_name) = '' OR LOWER(TRIM(full_name)) = 'undefined')
        """
    )

    conn.commit()

    # ── Seed default patients and users ─────────────────────────
    cursor.execute("SELECT COUNT(*) FROM patients")
    if cursor.fetchone()[0] == 0:
        # 1. Seed Patients
        cursor.execute(
            "INSERT INTO patients (name, age, gender, symptoms, severity, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("Priya Kapoor", 24, "Female", "Irregular menstrual cycles, weight gain, fatigue", "Medium", "EHR_Updated", datetime.now().isoformat())
        )
        patient1_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO patients (name, age, gender, symptoms, severity, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("Sneha Rao", 29, "Female", "Weight gain, extreme fatigue, dry skin, cold sensitivity", "Medium", "EHR_Updated", datetime.now().isoformat())
        )
        patient2_id = cursor.lastrowid

        # 2. No demo portal user rows here — default clinician account is ensured at end of init_db.

        # 3. Seed Clinical Summaries
        cursor.execute(
            "INSERT INTO clinical_summaries (patient_id, summary, diagnoses, risk_score, updated_at) VALUES (?, ?, ?, ?, ?)",
            (
                patient1_id,
                "Patient Priya Kapoor presents with irregular menstrual cycles, hirsutism, and mild insulin resistance. Pelvic ultrasound shows multiple small peripheral follicles. Clinical presentation is consistent with PCOD.",
                "PCOD (Polycystic Ovarian Disease)",
                45,
                datetime.now().isoformat()
            )
        )
        cursor.execute(
            "INSERT INTO clinical_summaries (patient_id, summary, diagnoses, risk_score, updated_at) VALUES (?, ?, ?, ?, ?)",
            (
                patient2_id,
                "Patient Sneha Rao presents with dry skin, cold intolerance, fatigue, and sluggishness. Laboratory tests reveal elevated TSH (8.2 mIU/L) and low Free T4 (0.7 ng/dL). Diagnosed with primary hypothyroidism.",
                "Hypothyroidism",
                50,
                datetime.now().isoformat()
            )
        )

        # 4. Seed Vitals
        cursor.execute("""
            INSERT INTO health_vitals (patient_id, heart_rate, systolic_bp, diastolic_bp, spo2, temperature, blood_sugar, bmi, weight, height, status, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (patient1_id, 74, 122, 78, 98.0, 98.4, 105.0, 26.2, 71.0, 164.0, "Warning", datetime.now().isoformat()))

        cursor.execute("""
            INSERT INTO health_vitals (patient_id, heart_rate, systolic_bp, diastolic_bp, spo2, temperature, blood_sugar, bmi, weight, height, status, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (patient2_id, 62, 115, 72, 97.0, 97.6, 90.0, 24.8, 68.0, 165.0, "Normal", datetime.now().isoformat()))

        # 5. Seed Diet Plans
        pcod_diet = {
            "macros": {"calories": 1600, "protein": "80g", "carbs": "120g (Low GI)", "fats": "50g"},
            "breakfast": "Oatmeal with chia seeds, flaxseeds, and almonds. Unsweetened almond milk. 1 boiled egg.",
            "mid_morning": "Green tea and a handful of walnuts.",
            "lunch": "Quinoa salad with grilled chicken breast or tofu, mixed leafy greens, cucumbers, and olive oil dressing.",
            "evening": "Sprouted moong chat or roasted chickpeas.",
            "dinner": "Baked salmon or paneer stir-fry with broccoli, bell peppers, and asparagus. Small portion of brown rice.",
            "rules": [
                "Avoid refined sugar and white flour entirely.",
                "Eat a protein-rich breakfast within 1 hour of waking.",
                "Drink 3 liters of water daily.",
                "Limit dairy products; prefer plant-based alternatives."
            ],
            "diet_notes": "Low glycemic load, high protein, rich in vitamins and minerals.",
            "medical_reference": "Laparoscopic ovarian drilling in resistant cases."
        }
        cursor.execute(
            "INSERT INTO diet_plans (patient_id, condition, plan_json, created_at) VALUES (?, ?, ?, ?)",
            (patient1_id, "PCOD (Polycystic Ovarian Disease)", json.dumps(pcod_diet), datetime.now().isoformat())
        )

        hypo_diet = {
            "macros": {"calories": 1500, "protein": "75g", "carbs": "140g", "fats": "45g"},
            "breakfast": "Scrambled eggs (2) with spinach (well-cooked) and 1 slice of gluten-free toast. 2 Brazil nuts (for selenium).",
            "mid_morning": "A bowl of papaya or apple.",
            "lunch": "Brown rice with grilled mackerel or paneer curry and cooked carrots.",
            "evening": "Roasted pumpkin seeds and herbal tea.",
            "dinner": "Lentil soup with mixed boiled vegetables (carrots, green beans) and grilled tofu or chicken.",
            "rules": [
                "Take thyroid medication on an empty stomach at least 1 hour before breakfast.",
                "Avoid raw cruciferous vegetables (cabbage, cauliflower, broccoli, kale); cook them thoroughly.",
                "Ensure adequate iodine and selenium intake.",
                "Avoid calcium or iron supplements within 4 hours of taking levothyroxine."
            ],
            "diet_notes": "Selenium-rich foods (Brazil nuts, seafood, eggs). Iodine (iodized salt, dairy). Avoid goitrogens raw.",
            "medical_reference": "Levothyroxine (Synthroid) 25-200mcg daily (taken on empty stomach)."
        }
        cursor.execute(
            "INSERT INTO diet_plans (patient_id, condition, plan_json, created_at) VALUES (?, ?, ?, ?)",
            (patient2_id, "Hypothyroidism", json.dumps(hypo_diet), datetime.now().isoformat())
        )

        # 6. Seed Imaging Scans
        cursor.execute(
            "INSERT INTO imaging_scans (patient_id, scan_type, priority, assigned_radiologist, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)",
            (patient1_id, "Ultrasound", "Routine", "Dr. Kavita Hegde (Pelvic Imaging)", "Completed yesterday", "Completed")
        )
        cursor.execute(
            "INSERT INTO imaging_scans (patient_id, scan_type, priority, assigned_radiologist, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)",
            (patient2_id, "Ultrasound", "Routine", "Dr. Kavita Hegde (Thyroid Imaging)", "Scheduled: Tomorrow morning", "Pending")
        )

        # 7. Seed demo appointments (no doctor user rows — care_team is display text only)
        now = datetime.now()
        appts = [
            (patient1_id, "Gynecology follow-up", "Dr. Ananya Sharma", "Curiva Outpatient — Block A", (now).isoformat(), "Scheduled", "PCOD care plan review"),
            (patient1_id, "Lab review (metabolic panel)", "Clinical lab", "Curiva Lab — Level 2", (now).isoformat(), "Completed", "Results available in portal"),
            (patient2_id, "Endocrinology consult", "Dr. Rajiv Mehta", "Curiva Outpatient — Block B", (now).isoformat(), "Scheduled", "Thyroid dosing review"),
            (patient2_id, "Thyroid ultrasound", "Dr. Kavita Hegde (Thyroid Imaging)", "Imaging suite — Wing 3", (now).isoformat(), "Scheduled", "Fasting not required"),
        ]
        cursor.executemany(
            "INSERT INTO appointments (patient_id, title, care_team, location, scheduled_at, status, notes) VALUES (?,?,?,?,?,?,?)",
            appts,
        )

        conn.commit()


    # ── Seed disease protocols ───────────────────────────────────
    cursor.execute("SELECT COUNT(*) FROM disease_protocols")
    if cursor.fetchone()[0] == 0:
        diseases = [
            (
                "PCOD (Polycystic Ovarian Disease)",
                "Women's Health",
                "PCOD is a condition where the ovaries produce large numbers of immature or partially mature eggs which develop into cysts. It affects 1 in 10 women of childbearing age.",
                "Irregular periods, weight gain, acne, excessive hair growth (hirsutism), thinning hair, mood swings, difficulty conceiving, multiple small ovarian cysts on ultrasound.",
                "Lifestyle modification is first-line treatment. Hormonal birth control pills regulate periods. Metformin improves insulin resistance. Letrozole/Clomiphene for ovulation induction. Laparoscopic ovarian drilling in resistant cases.",
                "Low glycemic index diet. Reduce refined carbs and sugar. Increase fiber (vegetables, legumes, whole grains). Anti-inflammatory foods (turmeric, omega-3). Limit dairy. Green tea beneficial. Maintain BMI < 25.",
                "Oral contraceptive pills (OCPs), Metformin 500-1500mg, Spironolactone (anti-androgen), Letrozole 2.5mg (fertility), Inositol supplements.",
                "150 min moderate exercise per week. Yoga and stress management. Maintain healthy weight — 5-10% weight loss can restore ovulation. Avoid smoking.",
                "Gynecologist / Reproductive Endocrinologist"
            ),
            (
                "PCOS (Polycystic Ovary Syndrome)",
                "Women's Health",
                "PCOS is a hormonal disorder causing enlarged ovaries with small cysts. It involves excess androgen levels and is associated with insulin resistance and metabolic syndrome.",
                "Irregular or absent menstrual periods, elevated androgens (testosterone), polycystic ovaries on ultrasound, obesity or central weight gain, insulin resistance, acne, hair loss, dark skin patches (acanthosis nigricans).",
                "Combination of lifestyle, hormonal, and metabolic therapy. Weight management is central. Hormonal therapy regulates menstrual cycle. Insulin sensitizers reduce metabolic risk. Anti-androgens reduce male hormone effects.",
                "Mediterranean diet. Low glycemic load. High protein breakfast. Avoid processed foods and trans fats. Inositol-rich foods (citrus, cantaloupe). Chromium foods. Intermittent fasting may help.",
                "Metformin, Combined OCPs (ethinylestradiol), Spironolactone 50-100mg, Eflornithine (for facial hair), Clomiphene/Letrozole for fertility.",
                "Daily 30-45 min aerobic + resistance training. Reduce chronic stress (cortisol worsens PCOS). Adequate sleep 7-8 hours. Avoid endocrine disruptors (BPA plastics).",
                "Gynecologist / Endocrinologist"
            ),
            (
                "Hypothyroidism",
                "Thyroid Disorders",
                "Hypothyroidism occurs when the thyroid gland does not produce enough thyroid hormone. Hashimoto's thyroiditis is the most common cause — an autoimmune condition.",
                "Fatigue and sluggishness, increased cold sensitivity, constipation, pale dry skin, brittle nails, puffy face, weight gain, muscle weakness and aches, depression, slowed heart rate, impaired memory.",
                "Levothyroxine (synthetic T4) is the standard treatment. Dose adjusted based on TSH levels every 6-8 weeks. Liothyronine (T3) added in select cases. Regular thyroid function monitoring.",
                "Selenium-rich foods (Brazil nuts, seafood, eggs). Iodine (iodized salt, dairy). Avoid goitrogens raw (cabbage, broccoli, soy) — cooking neutralizes them. Zinc (meat, seeds). Avoid excessive cruciferous vegetables.",
                "Levothyroxine (Synthroid) 25-200mcg daily (taken on empty stomach). Selenium 200mcg supplement. Vitamin D if deficient.",
                "Take medication consistently at the same time daily. Avoid calcium/iron supplements within 4 hours of medication. Regular TSH monitoring every 6 months. Exercise improves metabolism.",
                "Endocrinologist"
            ),
            (
                "Hyperthyroidism",
                "Thyroid Disorders",
                "Hyperthyroidism is overproduction of thyroid hormones. Graves' disease is the most common cause — an autoimmune disorder stimulating excess thyroid hormone production.",
                "Rapid heartbeat (tachycardia), unintentional weight loss, increased appetite, nervousness and anxiety, tremors, sweating, heat sensitivity, changes in menstrual patterns, enlarged thyroid (goiter), bulging eyes (Graves).",
                "Anti-thyroid medications (methimazole) are first-line. Radioactive iodine ablation is definitive. Beta-blockers for symptom control. Surgery (thyroidectomy) in select cases.",
                "Calcium and Vitamin D (at risk of bone loss). Avoid iodine-rich foods (seaweed, iodized salt). Anti-inflammatory diet. Cruciferous vegetables (goitrogenic — reduce thyroid activity, may help). Omega-3 fatty acids.",
                "Methimazole 5-30mg daily, Propylthiouracil (PTU) in pregnancy, Propranolol (beta-blocker for symptoms), Radioactive Iodine (I-131).",
                "Avoid stimulants (caffeine, tobacco). Stress reduction. Monitor bone density. Adequate rest. Follow-up every 4-6 weeks during treatment.",
                "Endocrinologist"
            ),
            (
                "Endometriosis",
                "Women's Health",
                "Endometriosis is a condition where tissue similar to the uterine lining grows outside the uterus — on ovaries, fallopian tubes, or pelvic lining — causing chronic pain and fertility issues.",
                "Severe pelvic pain especially during menstruation, dyspareunia (painful intercourse), dysuria (painful urination), heavy menstrual bleeding, infertility, fatigue, bloating, nausea during periods.",
                "Pain management (NSAIDs), hormonal therapy to suppress menstruation, laparoscopic excision or ablation of lesions. In severe cases, hysterectomy. IVF for infertility.",
                "Anti-inflammatory diet: omega-3 fatty acids, dark leafy greens, antioxidants (berries, nuts). Avoid red meat, alcohol, trans fats. High fiber to reduce excess estrogen. Magnesium-rich foods reduce cramping.",
                "NSAIDs (Ibuprofen, Naproxen), Combined OCPs, Progestin-only pills, GnRH agonists (Leuprolide), Aromatase inhibitors, Dienogest.",
                "Regular low-impact exercise (swimming, yoga). Heat therapy for pain. Stress management. Adequate sleep. Support groups. Track symptoms with a period diary.",
                "Gynecologist / Reproductive Surgeon"
            ),
            (
                "Uterine Fibroids",
                "Women's Health",
                "Uterine fibroids are non-cancerous growths of the uterus that often appear during childbearing years. They vary in size and number, causing menstrual and reproductive issues.",
                "Heavy prolonged menstrual periods, pelvic pressure or pain, frequent urination, difficulty emptying bladder, constipation, backache or leg pain, enlarged abdomen.",
                "Watchful waiting for small fibroids. Medications (GnRH agonists) to shrink fibroids. Uterine fibroid embolization (UFE). Myomectomy (fibroid removal). Hysterectomy for definitive cure.",
                "High fiber diet to reduce estrogen dominance. Green vegetables, cruciferous vegetables. Limit red meat and processed foods. Vitamin D and calcium. Avoid alcohol and caffeine. Iron-rich foods to counter anemia.",
                "GnRH agonists (Leuprolide), Progestins, Combined OCPs, Tranexamic acid (for bleeding), Iron supplements (for anemia), Ulipristal acetate.",
                "Maintain healthy weight (obesity increases estrogen). Regular exercise. Reduce stress. Monitor fibroid size with annual ultrasound.",
                "Gynecologist / Interventional Radiologist"
            ),
            (
                "Menstrual Disorders (Dysmenorrhea/Amenorrhea)",
                "Women's Health",
                "Dysmenorrhea refers to painful menstruation; Amenorrhea is the absence of menstrual periods. Both indicate underlying hormonal or structural issues requiring evaluation.",
                "Dysmenorrhea: cramping pain in lower abdomen, nausea, vomiting, diarrhea, headache during periods. Amenorrhea: missed periods for 3+ months, hormonal imbalance signs, stress or extreme exercise history.",
                "NSAIDs for pain, hormonal therapy to regulate cycles, treat underlying cause (PCOS, thyroid, eating disorders). Heat therapy, magnesium supplements reduce dysmenorrhea.",
                "Anti-inflammatory foods. Magnesium-rich foods (dark chocolate, leafy greens, nuts). Omega-3 fatty acids. Adequate iron. Limit caffeine and alcohol. Vitamin B1 (thiamine) and B6 shown to reduce dysmenorrhea.",
                "NSAIDs (Ibuprofen 400-800mg), Combined OCPs, Progesterone, Vitamin B1 100mg daily, Magnesium 250-350mg daily.",
                "Regular moderate exercise. Stress reduction (yoga, meditation). Adequate sleep. Heating pad for cramps. Track cycle with app. Avoid extreme weight loss or gain.",
                "Gynecologist"
            ),
            (
                "Osteoporosis (Women)",
                "Bone Health",
                "Osteoporosis is a condition where bones become weak and brittle. Women are at significantly higher risk, especially after menopause due to estrogen decline, which is critical for bone density.",
                "Often asymptomatic until fracture occurs. Back pain from vertebral fractures, loss of height over time, stooped posture, bones that fracture easily (wrist, hip, spine).",
                "Bisphosphonates (first-line) to slow bone loss. Calcium and Vitamin D supplementation essential. Denosumab (biological therapy). Teriparatide (bone-building). HRT considered post-menopause.",
                "Calcium: 1000-1200mg daily (dairy, fortified foods, tofu, almonds). Vitamin D: 800-1000 IU daily. Protein for bone matrix. Limit caffeine (>3 cups/day leaches calcium). Avoid excess sodium and alcohol.",
                "Alendronate 70mg weekly, Risedronate, Denosumab 60mg 6-monthly, Calcium carbonate 500mg twice daily, Vitamin D3 1000-2000 IU, Raloxifene (SERM) in postmenopausal women.",
                "Weight-bearing exercise (walking, dancing, resistance training). Avoid smoking. Fall prevention. Balance exercises. Adequate protein intake.",
                "Rheumatologist / Endocrinologist"
            ),
            (
                "Breast Health & Fibroadenoma",
                "Women's Health",
                "Fibroadenomas are the most common benign breast tumors, most frequently found in women aged 15-35. Breast health monitoring is critical for early detection of conditions including cancer.",
                "Painless, rubbery, mobile breast lump (fibroadenoma). Breast pain (mastalgia), nipple discharge, skin changes, asymmetry. For breast cancer: hard fixed lump, skin dimpling, nipple inversion.",
                "Fibroadenoma: watchful waiting, core biopsy for diagnosis, surgical excision if large. Mastalgia: NSAIDs, OCPs, evening primrose oil. Annual mammogram/ultrasound screening.",
                "Limit caffeine (worsens mastalgia). Anti-inflammatory diet. Maintain healthy weight (reduces breast cancer risk). Limit alcohol. Flaxseed and omega-3 for hormonal balance. Vitamin E for mastalgia.",
                "Evening primrose oil (for mastalgia), Danazol (severe mastalgia), Tamoxifen (risk reduction), NSAIDs for pain.",
                "Monthly self breast examination. Annual clinical examination. Regular screening mammography after 40. Limit alcohol. Maintain BMI < 25. Breastfeeding is protective.",
                "Gynecologist / Breast Surgeon"
            ),
            (
                "Cervical Health & HPV",
                "Women's Health",
                "Cervical cancer is largely preventable through HPV vaccination and regular Pap smear screening. HPV (Human Papillomavirus) is the primary cause of cervical cancer.",
                "Often asymptomatic in early stages. Abnormal vaginal bleeding (post-coital, between periods, post-menopause), unusual discharge, pelvic pain. Detected via Pap smear or HPV test.",
                "Prevention: HPV vaccine (Gardasil) for girls 9-14 years. Regular Pap smear every 3 years (age 21-65). CIN treatment: LEEP, cryotherapy. Cervical cancer: surgery, radiotherapy, chemotherapy.",
                "High antioxidant diet (Vitamins C, E, beta-carotene). Folate-rich foods. Limit processed meats. Avoid smoking. Maintain healthy immune system.",
                "HPV Vaccine (Gardasil 9), Folic acid supplementation, Interferon (investigational), Chemotherapy agents if cancer diagnosed.",
                "HPV vaccination before sexual debut. Condom use. No smoking. Regular screening. Limit sexual partners.",
                "Gynecologist / Oncologist"
            ),
        ]
        cursor.executemany(
            "INSERT OR IGNORE INTO disease_protocols (name,category,overview,symptoms,treatment,diet_notes,medications,lifestyle,specialist) VALUES (?,?,?,?,?,?,?,?,?)",
            diseases
        )
        conn.commit()

    # Additional protocols (dental, cardiac, dermatology, neurology, common conditions).
    # INSERT OR IGNORE keeps re-runs idempotent when name already exists.
    expansion_protocols = [
        (
            "Dental Caries (Tooth Decay)",
            "Dental & Oral Health",
            "Dental caries is localized destruction of enamel and dentin by acid-producing bacteria; it is the most common chronic disease worldwide and is largely preventable.",
            "Toothache, sensitivity to hot/cold/sweet, visible pits or brown spots, food trapping, bad breath; advanced cases may show swelling if pulp is involved.",
            "Remove decay and restore with filling (composite/amalgam); pulpotomy/root canal if pulpitis; crown if extensive loss; fluoride varnish and sealants for prevention; regular dental prophylaxis.",
            "Limit frequent sugary/acidic snacks and beverages; rinse water after meals; cheese/dairy and fibrous vegetables help buffer acid; adequate calcium and vitamin D for enamel support.",
            "Topical fluoride, chlorhexidine rinse (short courses), analgesics for pain (paracetamol/ibuprofen as appropriate), antibiotics only if spreading infection.",
            "Brush twice daily with fluoride toothpaste, floss or interdental brushes, replace brush every 3 months, dental check-up every 6 months.",
            "Dentist / Restorative Dentistry",
        ),
        (
            "Periodontitis (Gum Disease)",
            "Dental & Oral Health",
            "Periodontitis is chronic inflammation of supporting tooth structures leading to pocketing, bone loss, and tooth mobility if untreated.",
            "Bleeding gums, bad breath, gum recession, loose teeth, pain on chewing, purulent discharge from pockets.",
            "Scaling and root planing (deep cleaning), localized antimicrobial therapy, flap surgery in advanced cases; smoking cessation is essential; peri-implantitis managed similarly.",
            "Anti-inflammatory diet rich in omega-3, vitamin C (citrus, peppers), limit refined carbs; adequate hydration; avoid tobacco which worsens attachment loss.",
            "Chlorhexidine rinse, doxycycline sub-antimicrobial dose or localized antimicrobials as prescribed, metronidazole + amoxicillin for aggressive cases per dentist.",
            "Daily flossing/interdental cleaning, electric toothbrush, professional maintenance every 3–4 months after active therapy.",
            "Periodontist / Dentist",
        ),
        (
            "Acute Dental Abscess",
            "Dental & Oral Health",
            "A bacterial collection in tooth apex or periodontal tissues causing localized pain and swelling; can spread to deep neck spaces if untreated.",
            "Severe throbbing tooth pain, facial swelling, fever, trismus (difficulty opening mouth), tender lymph nodes, foul taste if draining sinus.",
            "Urgent dental drainage (incision, root canal, or extraction), culture-guided antibiotics if systemic signs; airway assessment if large swelling.",
            "Soft diet until resolved; avoid chewing on affected side; cold compresses externally for swelling; avoid alcohol with antibiotics.",
            "Amoxicillin-clavulanate or clindamycin (penicillin allergy), analgesics; IV antibiotics/hospital if systemic toxicity or airway concern.",
            "Seek same-day dental or emergency care; complete prescribed antibiotics; definitive dental treatment to prevent recurrence.",
            "Emergency Dentist / Oral & Maxillofacial Surgeon",
        ),
        (
            "Malocclusion & Orthodontic Care",
            "Dental & Oral Health",
            "Malocclusion refers to misaligned teeth or jaws affecting bite, aesthetics, speech, and hygiene; ranges from mild crowding to skeletal discrepancies.",
            "Crowding, spacing, overbite/overjet, crossbite, jaw pain, difficulty chewing, speech issues, excessive wear on some teeth.",
            "Braces or clear aligners, extractions if crowding severe, orthognathic surgery for skeletal cases, retainers after active treatment.",
            "Reduce sticky hard candies that break brackets; cut fibrous foods small; sugar control to prevent decalcification during orthodontics.",
            "Pain relief for adjustment soreness; fluoride rinse to protect enamel during fixed appliances.",
            "Excellent brushing around brackets, use of orthodontic brushes/water flosser, regular orthodontic adjustments.",
            "Orthodontist",
        ),
        (
            "Hypertension (High Blood Pressure)",
            "Heart & Vascular",
            "Hypertension is sustained elevation of blood pressure increasing risk of stroke, heart attack, kidney disease, and heart failure; often asymptomatic until organ damage.",
            "Often none; may include headache, blurred vision, epistaxis in severe cases; diagnosed by repeated BP readings ≥140/90 (or lower thresholds in diabetes/CKD per guidelines).",
            "Lifestyle first-line; medications include ACE inhibitors, ARBs, calcium channel blockers, thiazide diuretics; combination therapy common; evaluate secondary causes if resistant.",
            "DASH-style diet (vegetables, fruits, low-fat dairy), reduce sodium (<2g sodium/day), limit alcohol, potassium-rich foods if kidney function allows.",
            "Lisinopril, losartan, amlodipine, chlorthalidone, bisoprolol as examples — individualized by comorbidities, age, and labs.",
            "Home BP monitoring, weight loss if overweight, regular aerobic exercise, stress reduction, sleep apnea screening.",
            "Cardiologist / Primary Care Physician",
        ),
        (
            "Coronary Artery Disease (CAD)",
            "Heart & Vascular",
            "CAD is atherosclerotic narrowing of coronary arteries reducing blood flow to heart muscle, manifesting as angina or myocardial infarction.",
            "Chest pressure/tightness on exertion, shortness of breath, jaw/arm radiation, diaphoresis, nausea; ACS may have crushing pain at rest.",
            "Antiplatelet therapy, statins high-intensity, beta-blockers, ACE/ARB; revascularization (PCI/CABG) based on anatomy and symptoms; cardiac rehabilitation.",
            "Mediterranean diet, soluble fiber (oats, legumes), nuts in moderation, oily fish twice weekly, trans fat avoidance, limit saturated fat.",
            "Aspirin, high-intensity statin, metoprolol, nitroglycerin PRN, ticagrelor/clopidogrel post-PCI as indicated.",
            "Smoking cessation, graded exercise after cardiology clearance, diabetes and BP control, annual lipid review.",
            "Cardiologist / Interventional Cardiology",
        ),
        (
            "Heart Failure (HFrEF / HFpEF)",
            "Heart & Vascular",
            "Heart failure is inability of the heart to meet metabolic demands at normal filling pressures; classified by EF and often has multiple comorbid drivers.",
            "Exercise intolerance, orthopnea, paroxysmal nocturnal dyspnea, peripheral edema, fatigue, weight gain from fluid retention.",
            "Guideline-directed medical therapy for HFrEF: diuretics for congestion, ACEi/ARB/ARNI, beta-blockers, MRA, SGLT2 inhibitors; device therapy in select cases; HFpEF focuses on comorbidities.",
            "Sodium restriction (often 2g/day), fluid limits if hyponatremia, avoid excess alcohol; calorie control for obesity in HFpEF.",
            "Furosemide, spironolactone, carvedilol, sacubitril-valsartan, dapagliflozin — tailored to BP, potassium, renal function.",
            "Daily weights, activity as tolerated, influenza/pneumococcal vaccines, sleep apnea treatment, avoid NSAIDs that worsen fluid retention.",
            "Cardiologist / Heart Failure Specialist",
        ),
        (
            "Atrial Fibrillation (AF)",
            "Heart & Vascular",
            "AF is irregular, often rapid atrial rhythm predisposing to stroke, palpitations, and heart failure; may be paroxysmal, persistent, or permanent.",
            "Palpitations, irregular pulse, fatigue, dyspnea, dizziness; some patients are asymptomatic and detected incidentally.",
            "Stroke risk stratification (CHA2DS2-VASc) and anticoagulation; rate or rhythm control; catheter ablation in selected symptomatic cases; treat triggers (thyrotoxicosis, alcohol).",
            "Limit binge alcohol ('holiday heart'), moderate caffeine; weight loss improves outcomes in obesity-related AF.",
            "DOACs (apixaban, rivaroxaban) or warfarin; rate control: beta-blocker or diltiazem; rhythm control: flecainide, amiodarone, or cardioversion per specialist.",
            "Avoid stimulant decongestants if rate-sensitive; regular pulse checks; adherence to anticoagulation if indicated.",
            "Cardiologist / Electrophysiologist",
        ),
        (
            "Dyslipidemia (High Cholesterol)",
            "Heart & Vascular",
            "Elevated LDL-C and/or triglycerides increase atherosclerotic cardiovascular risk; often silent until events occur.",
            "Usually asymptomatic; severe hypertriglyceridemia may cause pancreatitis; xanthomas in genetic disorders.",
            "Statins first-line; ezetimibe, PCSK9 inhibitors for refractory LDL; fibrates or omega-3 for high triglycerides; address secondary causes (hypothyroidism, alcohol).",
            "Soluble fiber, plant sterols, reduce trans/saturated fats, fish intake; weight reduction lowers triglycerides.",
            "Atorvastatin, rosuvastatin, ezetimibe, icosapent ethyl for elevated TG with controlled LDL.",
            "Regular lipid panel, home cooking vs ultra-processed foods, aerobic exercise 150+ min/week.",
            "Cardiologist / Lipid Clinic / Primary Care",
        ),
        (
            "Atopic Dermatitis (Eczema)",
            "Skin & Dermatology",
            "Chronic relapsing inflammatory skin disease with barrier dysfunction and immune dysregulation; common in children but affects all ages.",
            "Dry itchy patches, lichenification, excoriations, flexural involvement in older children/adults, flares with allergens/stress/infections.",
            "Emollients cornerstone; topical corticosteroids or calcineurin inhibitors; crisaborole; phototherapy; dupilumab or JAK inhibitors for moderate-severe.",
            "Identify food triggers only if clearly linked; anti-inflammatory diet; probiotics evidence mixed; avoid harsh soaps; maintain hydration.",
            "Topical triamcinolone, tacrolimus ointment, oral antihistamines for itch at night, bleach baths only per clinician for recurrent superinfection.",
            "Short lukewarm showers, cotton clothing, stress management, nail trimming to reduce excoriation, treat Staph superinfection promptly.",
            "Dermatologist",
        ),
        (
            "Psoriasis (Plaque)",
            "Skin & Dermatology",
            "Immune-mediated hyperproliferation of keratinocytes with well-demarcated plaques; associated with psoriatic arthritis and cardiometabolic risk.",
            "Thick silvery scales on extensor surfaces, scalp/nail involvement, pruritus, joint pain/stiffness if PsA.",
            "Topical steroids and vitamin D analogs; phototherapy; systemic agents (methotrexate, acitretin, apremilast) or biologics (IL-17/IL-23/TNF inhibitors) for extensive disease.",
            "Weight reduction improves response to therapy; Mediterranean pattern; limit alcohol (especially with methotrexate); anti-inflammatory foods.",
            "Topical clobetasol, calcipotriene, biologics such as secukinumab or guselkumab in specialist care.",
            "Smoking cessation, joint-friendly exercise, cardiovascular risk reduction, skin trauma avoidance (Koebner phenomenon).",
            "Dermatologist / Rheumatologist (if PsA)",
        ),
        (
            "Acne Vulgaris",
            "Skin & Dermatology",
            "Disorder of pilosebaceous unit involving comedones, inflammation, and sometimes scarring; peaks in adolescence but persists in adults.",
            "Open/closed comedones, papules, pustules, nodules/cysts in severe acne; post-inflammatory hyperpigmentation especially in darker skin tones.",
            "Topical retinoids + benzoyl peroxide; topical antibiotics only with BP to reduce resistance; oral doxycycline; isotretinoin for nodulocystic scarring risk; hormonal therapy in select women.",
            "Low glycemic load may help some patients; dairy link debated; avoid picking; gentle non-comedogenic cleansers.",
            "Adapalene, benzoyl peroxide, clindamycin-BP combo, isotretinoin under strict pregnancy prevention program.",
            "Consistent skincare routine, sunscreen to reduce PIH, manage stress, non-comedogenic makeup.",
            "Dermatologist",
        ),
        (
            "Cellulitis (Bacterial Skin Infection)",
            "Skin & Dermatology",
            "Acute bacterial infection of dermis and subcutaneous tissue, commonly Streptococcus or Staphylococcus; requires prompt treatment to prevent spread.",
            "Expanding erythema, warmth, swelling, pain, fever; entry site may be minor wound, tinea pedis interdigital crack, or insect bite.",
            "Oral antibiotics for mild outpatient cases; IV antibiotics if systemic toxicity, immunosuppression, or facial/hand involvement; mark borders to track spread; limb elevation.",
            "Adequate protein and calories for healing; hydration; control blood glucose in diabetes to aid resolution.",
            "Cephalexin, dicloxacillin, clindamycin if penicillin allergy; vancomycin if MRSA concern per local guidelines.",
            "Treat athlete's foot to prevent recurrence, skin care to prevent cracks, prompt wound cleansing.",
            "Dermatologist / Emergency Medicine / Primary Care",
        ),
        (
            "Melanoma & Skin Cancer Awareness",
            "Skin & Dermatology",
            "Melanoma arises from melanocytes; early detection is curable while advanced disease requires multimodal oncology care.",
            "Changing mole (ABCDE: asymmetry, border, color, diameter >6mm, evolution), new pigmented lesion in adulthood, bleeding nodule.",
            "Wide local excision with sentinel lymph node biopsy staging; immunotherapy/targeted therapy for metastatic BRAF-mutant or advanced disease; sunscreen and surveillance for survivors.",
            "Antioxidant-rich diet supports general health; no diet replaces surgery; vitamin D monitoring if sun avoidance strict.",
            "Pembrolizumab, nivolumab, dabrafenib+trametinib in oncology protocols — specialist directed.",
            "Daily broad-spectrum SPF, protective clothing, avoid tanning beds, monthly self-skin exam, annual dermatoscopic screening if high risk.",
            "Dermatologist / Surgical Oncology / Oncologist",
        ),
        (
            "Migraine",
            "Brain & Neurology",
            "Migraine is a primary headache disorder with episodic attacks often featuring nausea, photophobia, and functional impairment.",
            "Unilateral pulsatile headache, nausea/vomiting, photophobia/phonophobia, worsened by activity; aura in subset (visual zigzags, sensory symptoms).",
            "Acute: triptans, NSAIDs, antiemetics; preventive: beta-blockers, topiramate, CGRP monoclonal antibodies, onabotulinumtoxinA for chronic migraine; lifestyle triggers management.",
            "Regular meals, adequate hydration, limit tyramine-rich aged cheeses and red wine if triggers; magnesium supplementation may help some.",
            "Sumatriptan, rizatriptan, naproxen, metoclopramide; preventives: propranolol, amitriptyline, erenumab.",
            "Sleep regularity, aerobic exercise, stress/CBT techniques, headache diary to identify triggers.",
            "Neurologist / Headache Specialist",
        ),
        (
            "Epilepsy",
            "Brain & Neurology",
            "Recurrent unprovoked seizures due to abnormal cortical hyperexcitability; many syndromes and etiologies across lifespan.",
            "Generalized tonic-clonic, absence spells, focal seizures with impaired awareness, postictal confusion; triggers include sleep deprivation, alcohol withdrawal, flashing lights (photosensitive subset).",
            "ASM monotherapy first then rational polytherapy; epilepsy surgery or neuromodulation (VNS, RNS, DBS) for drug-resistant focal epilepsy; ketogenic diet in select pediatric cases.",
            "Consistent meals if on ASMs affecting sodium; vitamin D bone health with enzyme-inducing drugs; alcohol moderation.",
            "Levetiracetam, lamotrigine, valproate (avoid pregnancy), carbamazepine for focal — individualized by syndrome, sex, comorbidities.",
            "Sleep hygiene, driving restrictions per law/neurology, medication adherence, rescue benzodiazepine plan if prescribed.",
            "Neurologist / Epileptologist",
        ),
        (
            "Ischemic Stroke & Secondary Prevention",
            "Brain & Neurology",
            "Stroke is acute focal brain injury due to vessel occlusion or rupture; ischemic subtype treated with reperfusion when within window.",
            "Sudden unilateral weakness, facial droop, speech difficulty, visual field cut, ataxia — 'BE FAST' mnemonic for recognition.",
            "Hyperacute: IV thrombolysis and/or mechanical thrombectomy in eligible patients; secondary prevention with antiplatelet/anticoagulation based on etiology, intensive statin, BP control.",
            "Mediterranean diet (PURE/MIND patterns associated with lower risk); sodium moderation for hypertension; adequate fiber.",
            "Aspirin + clopidogrel short dual window in minor stroke/TIA per guidelines, aspirin alone long-term if non-cardioembolic, DOAC if AF-related.",
            "Smoking cessation, diabetes control, cardiac rhythm monitoring for occult AF, rehabilitation (PT/OT/speech).",
            "Neurologist / Stroke Team / Neurorehabilitation",
        ),
        (
            "Parkinson's Disease",
            "Brain & Neurology",
            "Neurodegenerative disorder characterized by loss of dopaminergic neurons in substantia nigra causing bradykinesia, rigidity, tremor, and postural instability.",
            "Resting tremor, slowness of movement, masked facies, shuffling gait, micrographia, non-motor symptoms (REM sleep behavior disorder, constipation, depression).",
            "Levodopa-carbidopa remains gold standard; dopamine agonists, MAO-B inhibitors, COMT inhibitors as adjuncts; advanced therapies DBS, Duodopa, apomorphine pump in later stages.",
            "High-fiber diet for constipation; protein timing discussions with neurology (some use protein redistribution for motor fluctuations).",
            "Levodopa/carbidopa, pramipexole, rasagiline, entacapone — titrated to balance benefit vs dyskinesia/off periods.",
            "Regular exercise (dance, tai chi) improves balance; fall prevention; speech therapy for hypophonia; caregiver support.",
            "Neurologist / Movement Disorders Specialist",
        ),
        (
            "Alzheimer's Disease & Related Dementias",
            "Brain & Neurology",
            "Progressive neurodegenerative cognitive decline interfering with independence; Alzheimer's is most common pathology with amyloid/tau interplay.",
            "Short-term memory loss, repetition, word-finding difficulty, impaired judgment, spatial disorientation, behavioral changes in mid-late stages.",
            "Cholinesterase inhibitors and memantine for symptomatic modest benefit; manage cardiovascular risk; newer anti-amyloid therapies in specific early AD populations per specialist criteria; caregiver education.",
            "MIND/Mediterranean dietary patterns associated with slower decline in observational studies; treat vitamin B12 deficiency; avoid alcohol excess.",
            "Donepezil, rivastigmine, galantamine, memantine; manage sleep, mood, and psychosis thoughtfully to avoid excessive antipsychotic use.",
            "Cognitive stimulation, routine structure, driving cessation when unsafe, legal/financial planning early, wandering precautions.",
            "Neurologist / Geriatric Psychiatrist / Memory Clinic",
        ),
        (
            "Type 2 Diabetes Mellitus",
            "Metabolic & Endocrine",
            "Insulin resistance with relative insulin deficiency leading to hyperglycemia and microvascular/macrovascular complications over time.",
            "Polyuria, polydipsia, fatigue, blurred vision, slow wound healing; many diagnosed on screening without symptoms.",
            "Lifestyle modification, metformin first-line; add SGLT2i/GLP-1 RA for CV/renal benefits when indicated; insulin if beta-cell failure; structured glucose monitoring.",
            "Carbohydrate awareness, fiber-rich foods, limit sugar-sweetened beverages, weight loss of 5–10% improves glycemic control.",
            "Metformin, empagliflozin, semaglutide, basal insulin — individualized by comorbidities, eGFR, cost.",
            "Foot daily inspection, dilated eye exams, BP/lipid control, dental care, smoking cessation.",
            "Endocrinologist / Primary Care",
        ),
        (
            "Asthma",
            "Respiratory",
            "Chronic airway inflammation with reversible obstruction and bronchial hyperresponsiveness; episodic wheeze, cough, chest tightness.",
            "Wheeze, cough worse at night/exercise, chest tightness, variable peak flows; exacerbations triggered by viral URI, allergens, pollution.",
            "Inhaled corticosteroids backbone; SABA only as reliever with ICS-formoterol maintenance-and-reliever in appropriate patients; biologics for severe T2-high asthma; action plan for exacerbations.",
            "No specific diet cures asthma; anti-inflammatory diet pattern; weight loss if obesity complicates symptoms; avoid sulfite-sensitive triggers if rare sensitivity.",
            "ICS/LABA combinations, albuterol, montelukast (with neuropsychiatric risk counseling), omalizumab for allergic severe asthma.",
            "Trigger avoidance, annual flu vaccine, exercise with adequate warm-up, smoking cessation, adherence to prevent exacerbations.",
            "Pulmonologist / Allergist",
        ),
        (
            "Chronic Obstructive Pulmonary Disease (COPD)",
            "Respiratory",
            "Progressive airflow limitation usually from smoking-related emphysema/chronic bronchitis; exacerbations drive morbidity.",
            "Chronic cough, sputum, dyspnea on exertion progressing to rest, frequent respiratory infections, barrel chest in advanced disease.",
            "Smoking cessation paramount; LABA/LAMA bronchodilators, ICS in frequent exacerbators, pulmonary rehab, oxygen if chronic hypoxemia, vaccines, acute exacerbation steroids/antibiotics per protocols.",
            "Small frequent meals if dyspnea limits large meals; adequate protein to preserve respiratory muscle mass; hydration for mucus clearance.",
            "Tiotropium, salmeterol-fluticasone, roflumilast in chronic bronchitis phenotype, azithromycin prophylaxis selective cases.",
            "Pursed-lip breathing, energy conservation, home spirometry if available, avoid sedatives that suppress respiratory drive.",
            "Pulmonologist",
        ),
        (
            "Community-Acquired Pneumonia",
            "Respiratory",
            "Infection of lung parenchyma acquired outside hospital; severity ranges from outpatient 'walking pneumonia' to sepsis requiring ICU.",
            "Fever, productive cough, pleuritic chest pain, tachypnea, hypoxia; elderly may present with confusion without classic fever.",
            "Empiric antibiotics based on severity and local resistance; oxygen, IV fluids if septic; CURB-65/PSI for disposition; follow-up chest imaging if non-resolving.",
            "High fluid intake unless contraindicated; protein-rich foods during recovery; avoid alcohol during macrolide therapy if used.",
            "Amoxicillin, azithromycin, doxycycline outpatient; ceftriaxone + azithromycin inpatient moderate-severe — per local guidelines.",
            "Rest, incentive spirometry after hospitalization, pneumococcal and influenza vaccines after recovery.",
            "Pulmonologist / Primary Care / Emergency Medicine",
        ),
        (
            "GERD & Peptic Ulcer Disease",
            "Digestive Health",
            "GERD is reflux of gastric contents causing esophageal symptoms; PUD involves mucosal break from acid and often H. pylori or NSAIDs.",
            "Heartburn, regurgitation, epigastric pain, bloating; alarm symptoms: dysphagia, weight loss, GI bleeding warrant urgent evaluation.",
            "PPI trial for GERD; test-and-treat H. pylori for ulcer; discontinue offending NSAIDs; H2 blockers for mild cases; surgery in refractory GERD.",
            "Smaller meals, avoid late-night eating, reduce caffeine/chocolate/spicy/fatty triggers if symptomatic; weight loss lowers reflux.",
            "Omeprazole, pantoprazole, sucralfate, H. pylori triple/quad therapy if positive.",
            "Elevate head of bed, left lateral sleep may help, avoid tight belts, smoking cessation.",
            "Gastroenterologist / Primary Care",
        ),
        (
            "Chronic Kidney Disease (CKD)",
            "Kidney & Urology",
            "Gradual loss of kidney function over months to years staged by eGFR and albuminuria; accelerates cardiovascular risk.",
            "Often asymptomatic early; later fatigue, edema, nocturia, pruritus, nausea, metallic taste; labs show rising creatinine, anemia, mineral bone disorder.",
            "BP control, RAAS blockade if safe, SGLT2 inhibitors to slow progression, correct acidosis/anemia, prepare for renal replacement therapy when approaching ESRD.",
            "Protein moderation in advanced CKD, sodium restriction, potassium/phosphate awareness per labs; avoid high-dose NSAIDs.",
            "ACEi/ARB, finerenone in diabetic CKD with albuminuria, erythropoiesis-stimulating agents if indicated, phosphate binders.",
            "Avoid nephrotoxic contrast when possible, medication dose adjustments by eGFR, blood pressure home monitoring.",
            "Nephrologist",
        ),
        (
            "Urinary Tract Infection (UTI)",
            "Kidney & Urology",
            "Bacterial infection of lower (cystitis) or upper (pyelonephritis) urinary tract; more common in women and older adults.",
            "Dysuria, frequency, urgency, suprapubic pain; fever/flank pain suggests pyelonephritis; confusion in elderly may be only sign.",
            "Antibiotics guided by local resistance; adequate hydration; differentiate uncomplicated vs complicated (pregnancy, stones, catheters); imaging if recurrent.",
            "Cranberry products may reduce recurrence in some women but evidence mixed; avoid bladder irritants during infection; probiotics adjunct debated.",
            "Nitrofurantoin, trimethoprim-sulfamethoxazole, fosfomycin single dose for uncomplicated cystitis per guidelines.",
            "Voiding after intercourse may help prevention, avoid spermicide diaphragm if recurrent UTIs, treat constipation.",
            "Urologist / Primary Care / Gynecologist",
        ),
        (
            "Osteoarthritis",
            "Musculoskeletal",
            "Degenerative joint disease with cartilage loss, osteophytes, and pain worse with activity; knees, hips, hands most common.",
            "Joint pain/stiffness <30 min morning stiffness, crepitus, reduced range of motion, Heberden's nodes in hands.",
            "Weight loss if knee OA, exercise/physical therapy, topical NSAIDs, oral NSAIDs/coxibs short term, intra-articular steroids, joint replacement for end-stage.",
            "Anti-inflammatory diet; omega-3; vitamin D if deficient; glucosamine/chondroitin evidence weak.",
            "Acetaminophen first-line oral analgesic for many; celecoxib if CV/GI risk acceptable, intra-articular triamcinolone.",
            "Low-impact aerobic exercise, quadriceps strengthening, braces/assistive devices, heat/cold packs.",
            "Orthopedic Surgeon / Rheumatologist / Physiatrist",
        ),
        (
            "Rheumatoid Arthritis",
            "Musculoskeletal",
            "Autoimmune symmetric inflammatory arthritis causing erosions and systemic inflammation if untreated.",
            "Morning stiffness >60 minutes, MCP/PIP swelling, rheumatoid nodules, fatigue; elevated inflammatory markers and autoantibodies.",
            "Early DMARD therapy (methotrexate anchor); short bridging steroids; biologic/JAK inhibitors if inadequate response; treat to target remission/low disease activity.",
            "Mediterranean diet; omega-3; limit alcohol with methotrexate; calcium/vitamin D with glucocorticoids.",
            "Methotrexate + folic acid, sulfasalazine, hydroxychloroquine, adalimumab, tofacitinib — monitoring LFTs/CBC/lipids per agent.",
            "Smoking cessation (strong RF), joint protection, hand therapy, cardiovascular risk reduction.",
            "Rheumatologist",
        ),
        (
            "Iron Deficiency Anemia",
            "Hematology",
            "Reduced hemoglobin due to inadequate iron for erythropoiesis; causes include blood loss, poor intake, malabsorption.",
            "Fatigue, pallor, tachycardia on exertion, brittle nails, pica (ice craving), restless legs; GI blood loss must be evaluated in men/postmenopausal women.",
            "Oral ferrous sulfate with vitamin C; IV iron if malabsorption or intolerance; treat source of bleeding (menorrhagia, ulcers, malignancy workup).",
            "Iron-rich foods (lean red meat, lentils, spinach with vitamin C), limit tea/coffee with meals (reduces absorption).",
            "Ferrous sulfate 325mg elemental strategies per tolerance, IV ferric carboxymaltose if indicated.",
            "Menstrual management if heavy periods, NSAID sparing if GI bleed risk, follow hemoglobin/ferritin.",
            "Hematologist / Primary Care / Gastroenterologist",
        ),
        (
            "Acute Viral Gastroenteritis",
            "Digestive Health",
            "Self-limited intestinal infection commonly norovirus or rotavirus causing diarrhea and vomiting; dehydration is main risk.",
            "Watery diarrhea, vomiting, cramps, low-grade fever; usually resolves in 2–5 days; blood in stool suggests bacterial etiology.",
            "Oral rehydration solution, zinc in children per WHO, symptomatic antiemetics cautiously; antibiotics only for selected bacterial cases.",
            "BRAT-style bland foods as tolerated after fluid repletion; avoid dairy temporarily if lactase transient deficiency; avoid sugary drinks worsening osmotic diarrhea.",
            "ORS packets, ondansetron short course, azithromycin only if traveler’s dysentery suspected per clinician.",
            "Hand hygiene, food safety, rotavirus vaccine in infants, return precautions for lethargy or no urine output.",
            "Primary Care / Emergency Medicine",
        ),
        (
            "Acute Conjunctivitis (Pink Eye)",
            "Eye & ENT",
            "Inflammation of conjunctiva from viral, bacterial, or allergic causes; viral most common in adults, bacterial more purulent.",
            "Red eye, tearing, discharge (watery viral vs thick bacterial), itching allergic, foreign body sensation.",
            "Supportive care for viral; topical antibiotics for bacterial suspicion; antihistamine/mast cell stabilizers for allergic; urgent referral if severe pain, vision loss, copious pus, corneal involvement.",
            "No specific diet; avoid contact lenses during infection; cool compresses for allergic type.",
            "Erythromycin ointment, fluoroquinolone drops short course if bacterial per clinician; avoid steroid drops without slit-lamp exam.",
            "Hand washing, no sharing towels, discard cosmetics used during infection, return if vision changes.",
            "Ophthalmologist / Primary Care",
        ),
        (
            "Acute Otitis Media",
            "Eye & ENT",
            "Middle ear infection common in children after URI; can cause ear pain, fever, hearing reduction.",
            "Ear pain, fever, irritability in infants, conductive hearing loss, bulging tympanic membrane on exam.",
            "Pain control; antibiotics in younger children, bilateral/severe cases, or observation in select older uncomplicated per guidelines; myringotomy if complications.",
            "Maintain hydration; no evidence for dairy restriction despite myths.",
            "Amoxicillin high dose first-line; amoxicillin-clavulanate if recent beta-lactam; analgesics weight-based in children.",
            "Avoid smoke exposure, pneumococcal conjugate vaccine per schedule, allergy evaluation if recurrent infections.",
            "ENT / Pediatrician / Primary Care",
        ),
        (
            "Depression (Major Depressive Disorder)",
            "Mental Health",
            "Mood disorder with persistent low mood, anhedonia, and cognitive/vegetative signs impacting function; multifactorial etiology.",
            "Sadness, loss of interest, sleep/appetite changes, guilt, poor concentration, suicidality in severe cases — PHQ-9 screening tool.",
            "Psychotherapy (CBT, IPT), SSRIs/SNRIs, augmentation strategies, TMS/ECT for treatment-resistant or urgent cases; safety planning if suicidal ideation.",
            "Mediterranean diet patterns modestly associated with lower depression risk; limit alcohol (depressant); regular caffeine moderation.",
            "Sertraline, escitalopram, bupropion, mirtazapine — individualized by comorbid insomnia/anxiety, drug interactions.",
            "Sleep schedule, daylight exposure, exercise, social connection, crisis hotline if suicidal thoughts.",
            "Psychiatrist / Psychologist / Licensed Therapist",
        ),
        (
            "Generalized Anxiety Disorder (GAD)",
            "Mental Health",
            "Excessive worry more days than not for ≥6 months with associated restlessness, fatigue, concentration problems, muscle tension, sleep disturbance.",
            "Persistent worry about multiple domains, irritability, palpitations, GI upset, hypervigilance.",
            "CBT first-line; SSRIs/SNRIs effective; buspirone; short-term benzodiazepines generally avoided; mindfulness and sleep hygiene.",
            "Reduce excess caffeine; regular meals; magnesium-rich foods may mildly help anxiety in some; limit alcohol rebound anxiety.",
            "Escitalopram, venlafaxine XR, duloxetine, hydroxyzine PRN sleep — per prescriber.",
            "Breathing exercises, graded exposure, limit reassurance-seeking behaviors, structured worry time technique in CBT.",
            "Psychiatrist / Psychologist",
        ),
        (
            "Chronic Hepatitis B Infection",
            "Digestive Health",
            "HBV can persist with risk of cirrhosis and hepatocellular carcinoma; phases include immune tolerant, immune active, inactive carrier.",
            "Often asymptomatic; fatigue, RUQ discomfort; abnormal ALT, detectable HBV DNA, HBeAg status guides treatment.",
            "Antiviral suppression with entecavir or tenofovir in immune-active or cirrhotic patients; surveillance ultrasound/AFP for HCC; family vaccination.",
            "Avoid alcohol; coffee intake modestly associated with lower HCC risk in some cohorts; balanced diet; weight control for NAFLD overlap.",
            "Tenofovir alafenamide or disoproxil, entecavir; pegylated interferon rarely selected.",
            "Regular specialist monitoring, household/sexual partner immunization, careful drug choices (acetaminophen within limits).",
            "Hepatologist / Gastroenterologist",
        ),
        (
            "Influenza (Seasonal Flu)",
            "Infectious Disease",
            "Acute viral respiratory illness caused by influenza A/B with yearly epidemics; complications include pneumonia especially in elderly and chronic disease.",
            "Sudden fever, myalgia, headache, dry cough, malaise; can overlap with COVID-19 — testing during outbreaks may be needed.",
            "Supportive care; neuraminidase inhibitors (oseltamivir) if started early in high-risk or severe disease; annual vaccination primary prevention.",
            "Fluids, warm soups, honey for cough if age >1 year, avoid dehydration; rest.",
            "Oseltamivir, baloxavir in selected patients per timing and guidelines.",
            "Annual flu shot, hand hygiene, mask during high transmission if vulnerable, return if respiratory distress.",
            "Primary Care / Infectious Disease / Emergency Medicine",
        ),
        (
            "Allergic Rhinitis (Hay Fever)",
            "Eye & ENT",
            "IgE-mediated inflammation of nasal mucosa triggered by aeroallergens causing sneezing, congestion, and itch.",
            "Sneezing, itchy nose/eyes, clear rhinorrhea, nasal congestion, post-nasal drip; seasonal or perennial pattern.",
            "Intranasal corticosteroids first-line; second-generation oral antihistamines; leukotriene receptor antagonist; allergen immunotherapy for refractory cases.",
            "Local honey not proven; spicy foods transiently open nose but not therapy; avoid identified food allergens unrelated to aeroallergen rhinitis.",
            "Fluticasone nasal spray, cetirizine, montelukast (with FDA boxed warning awareness for neuropsychiatric events).",
            "HEPA filtration, wash bedding hot, keep windows closed high pollen days, saline rinses.",
            "Allergist / ENT / Primary Care",
        ),
        (
            "Gout & Hyperuricemia",
            "Musculoskeletal",
            "Inflammatory arthritis from monosodium urate crystal deposition, often first metatarsophalangeal joint podagra, linked to hyperuricemia.",
            "Sudden severe joint redness/swelling, pain peaks within hours, tophi in chronic untreated disease, renal stones.",
            "Acute: NSAIDs, colchicine, or corticosteroids; chronic: urate-lowering therapy (allopurinol, febuxostat) with prophylaxis against flare when starting ULT.",
            "Limit high-purine foods (organ meats, certain seafood), reduce fructose-sweetened beverages, alcohol especially beer; cherry extract modest evidence.",
            "Colchicine low dose, indomethacin, allopurinol after acute flare treated — under physician guidance.",
            "Weight loss, hydration, blood pressure control, avoid thiazide diuretics if recurrent gout when alternatives exist.",
            "Rheumatologist / Primary Care",
        ),
        (
            "Benign Prostatic Hyperplasia (BPH)",
            "Kidney & Urology",
            "Noncancerous prostate enlargement causing lower urinary tract symptoms in aging men.",
            "Weak stream, hesitancy, frequency, nocturia, incomplete emptying, occasional acute urinary retention.",
            "Alpha-blockers relax smooth muscle; 5-alpha-reductase inhibitors shrink prostate over months; combination in large glands; surgery (TURP, HoLEP) if failed meds or retention.",
            "Limit fluids before bedtime, reduce caffeine/alcohol bladder irritants, double voiding technique, constipation management.",
            "Tamsulosin, finasteride, dutasteride, tadalafil also approved for LUTS in some regions.",
            "Annual PSA discussion per guidelines, bladder diary, seek care if hematuria or recurrent infections.",
            "Urologist",
        ),
        (
            "Osteoporosis (General)",
            "Bone Health",
            "Low bone mass and microarchitectural deterioration increasing fracture risk in men and women; often silent until fragility fracture.",
            "Height loss, kyphosis, wrist/hip/spine fractures from low trauma; DXA T-score ≤-2.5 defines osteoporosis.",
            "Bisphosphonates, denosumab, anabolic agents (teriparatide, romosozumab) in sequence per guidelines; fall prevention; calcium/vitamin D baseline.",
            "Calcium 1000–1200mg/day, vitamin D, adequate protein, limit sodium and excess alcohol, caffeine moderation.",
            "Alendronate weekly, zoledronic acid annually IV, denosumab 6-monthly SC.",
            "Weight-bearing and resistance exercise, home hazard reduction, vision correction, smoking cessation.",
            "Endocrinologist / Rheumatologist / Orthopedic Surgeon",
        ),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO disease_protocols (name,category,overview,symptoms,treatment,diet_notes,medications,lifestyle,specialist) VALUES (?,?,?,?,?,?,?,?,?)",
        expansion_protocols,
    )
    cursor.executemany(
        "INSERT OR IGNORE INTO disease_protocols (name,category,overview,symptoms,treatment,diet_notes,medications,lifestyle,specialist) VALUES (?,?,?,?,?,?,?,?,?)",
        child_disease_protocol_rows(),
    )
    conn.commit()

    # Existing installs: seed appointments if table is empty (no dependency on demo doctor users)
    cursor.execute("SELECT COUNT(*) FROM appointments")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT id FROM patients ORDER BY id")
        pids = [r[0] for r in cursor.fetchall()]
        if pids:
            now = datetime.now().isoformat()
            ap_rows = []
            for pid in pids:
                ap_rows.append(
                    (pid, "Primary care visit", "Curiva care team", "Main OPD — Ground floor", now, "Scheduled", "Arrive 15 minutes early with ID."),
                )
                ap_rows.append(
                    (pid, "Lab / diagnostics", "Clinical laboratory", "Lab — Level 2", now, "Scheduled", "Optional fasting per lab instructions."),
                )
            cursor.executemany(
                "INSERT INTO appointments (patient_id, title, care_team, location, scheduled_at, status, notes) VALUES (?,?,?,?,?,?,?)",
                ap_rows,
            )
    # Demo lab reports so "My records" shows pathology / test history
    cursor.execute("SELECT COUNT(*) FROM patient_test_reports")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT id, name FROM patients ORDER BY id")
        for row in cursor.fetchall():
            pid, pname = row[0], row[1]
            now = datetime.now().isoformat()
            demo_items = json.dumps(["CBC", "Fasting glucose", "Lipid profile", "TSH"])
            cursor.execute(
                """
                INSERT INTO patient_test_reports (patient_id, title, lab_name, items_json, scheduled_at, status, result_summary, created_at)
                VALUES (?,?,?,?,?,?,?,?)
                """,
                (
                    pid,
                    f"Outpatient lab panel — {pname}",
                    "Curiva Lab — Level 2",
                    demo_items,
                    now,
                    "Completed",
                    "All critical values within lab reference ranges. Mild LDL elevation — dietary review suggested. Full PDF available at front desk (demo).",
                    now,
                ),
            )
    cursor.execute("SELECT COUNT(*) FROM users WHERE LOWER(TRIM(COALESCE(role,''))) = 'doctor'")
    if cursor.fetchone()[0] == 0:
        now_iso = datetime.now().isoformat()
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, role, full_name, email, patient_id, created_at, approval_status)
            VALUES (?, ?, 'doctor', ?, ?, NULL, ?, 'approved')
            """,
            ("doctor1", hash_password("doctor123"), DEFAULT_DOCTOR_DISPLAY_NAME, "doctor@curiva.ai", now_iso),
        )

    # Demo hospital management login (registry / staff registration — no patient chart)
    cursor.execute("SELECT id FROM users WHERE LOWER(TRIM(username)) = ?", ("hospitalmgr",))
    if not cursor.fetchone():
        now_iso = datetime.now().isoformat()
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, role, full_name, email, patient_id, site_city, site_hospital, created_at, approval_status)
            VALUES (?, ?, 'manager', ?, ?, NULL, ?, ?, ?, 'approved')
            """,
            (
                "hospitalmgr",
                hash_password("hospital123"),
                "Hospital Administrator",
                "admin@curiva.ai",
                "Delhi",
                "Curiva Central (demo)",
                now_iso,
            ),
        )

    repair_patient_user_links(cursor)
    conn.commit()

    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
