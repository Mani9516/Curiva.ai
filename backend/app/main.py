from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from datetime import datetime
from typing import Optional, List

from app.db import get_db_conn, init_db, hash_password, repair_patient_user_links, new_patient_qr_token
from app.indian_doctors import radiologist_for_study
from app.agents.orchestrator import WorkflowOrchestrator
from app.agents.base import HealthMonitorAgent, DietPlanAgent
from app.rag.rag_service import RAGService
from app.rl.agent import QLearningAgent
import json
import random
import secrets


def _role_is_clinic_or_hospital_admin(role: Optional[str]) -> bool:
    r = (role or "").strip().lower()
    return r in ("doctor", "manager")


app = FastAPI(title="Curiva Backend", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize singletons
orchestrator = WorkflowOrchestrator()
rag_service = RAGService()
rl_agent = QLearningAgent()


def _insert_random_ehr_for_patient(
    cursor,
    display_name: str,
    site_city: Optional[str] = None,
    site_hospital: Optional[str] = None,
) -> int:
    """
    Create a new registry patient row with randomized demo-like demographics and a minimal clinical summary.
    Used for patient self-registration and staff-created portal accounts (user + EHR linked to the same site).
    """
    now = datetime.now().isoformat()
    name = (display_name or "").strip() or "Patient"
    sc = (site_city or "").strip() or None
    sh = (site_hospital or "").strip() or None
    age = random.randint(18, 72)
    gender = random.choice(["Female", "Male", "Other"])
    severity = random.choice(["Low", "Medium", "Medium", "Medium", "Urgent"])
    symptoms = random.choice(
        [
            "Portal activation — routine intake; no acute complaints.",
            "General wellness — fatigue and sleep to review at next visit.",
            "Allergic symptoms and occasional wheeze; monitoring plan.",
            "GI upset and dietary adjustment; hydration counseling.",
            "Headaches and screen-time strain; lifestyle review suggested.",
            "Joint aches with activity; conservative management.",
        ]
    )
    cursor.execute(
        """
        INSERT INTO patients (name, age, gender, symptoms, severity, status, created_at, site_city, site_hospital, qr_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (name, age, gender, symptoms, severity, "Approved_Portal", now, sc, sh, new_patient_qr_token()),
    )
    pid = cursor.lastrowid
    summary = (
        f"{name} ({age}y, {gender}) — automated EHR allocation after portal approval. "
        "Presenting for coordinated ambulatory care; baseline risk stratification in progress."
    )
    diagnoses = random.choice(
        [
            "Ambulatory follow-up",
            "Health maintenance",
            "Symptom surveillance",
            "Chronic care coordination",
        ]
    )
    risk = random.randint(18, 48)
    cursor.execute(
        """
        INSERT OR REPLACE INTO clinical_summaries (patient_id, summary, diagnoses, risk_score, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (pid, summary, diagnoses, risk, now),
    )
    return pid


def _ensure_patient_qr_token(cursor, patient_row) -> dict:
    p = dict(patient_row)
    tok = (p.get("qr_token") or "").strip()
    if not tok:
        tok = new_patient_qr_token()
        cursor.execute("UPDATE patients SET qr_token = ? WHERE id = ?", (tok, p["id"]))
        p["qr_token"] = tok
    return p


def _patient_linked_user(cursor, patient_id: int) -> Optional[dict]:
    cursor.execute(
        """
        SELECT username, full_name, email, site_city, site_hospital
        FROM users WHERE patient_id = ? LIMIT 1
        """,
        (patient_id,),
    )
    row = cursor.fetchone()
    return dict(row) if row else None


def _build_patient_qr_card(patient: dict, linked_user: Optional[dict] = None) -> dict:
    lu = linked_user or {}
    hospital = (patient.get("site_hospital") or lu.get("site_hospital") or "").strip()
    city = (patient.get("site_city") or lu.get("site_city") or "").strip()
    return {
        "system": "Curiva",
        "token": patient.get("qr_token"),
        "patient_id": patient["id"],
        "name": patient.get("name"),
        "age": patient.get("age"),
        "gender": patient.get("gender"),
        "status": patient.get("status"),
        "severity": patient.get("severity"),
        "site_hospital": hospital or None,
        "site_city": city or None,
        "created_at": patient.get("created_at"),
        "portal_username": lu.get("username"),
        "email": lu.get("email"),
        "full_name": lu.get("full_name"),
    }


def _patient_qr_text(card: dict) -> str:
    lines = [
        "CURIVA | PATIENT RECORD",
        f"Record ID: #{card.get('patient_id')}",
        f"QR Token: {card.get('token')}",
        f"Name: {card.get('name')}",
        f"Age: {card.get('age')} | Gender: {card.get('gender')}",
    ]
    if card.get("site_hospital"):
        lines.append(f"Hospital: {card['site_hospital']}")
    if card.get("site_city"):
        lines.append(f"City: {card['site_city']}")
    if card.get("status"):
        lines.append(f"Status: {card['status']}")
    if card.get("severity"):
        lines.append(f"Triage: {card['severity']}")
    if card.get("email"):
        lines.append(f"Email: {card['email']}")
    if card.get("portal_username"):
        lines.append(f"Portal: @{card['portal_username']}")
    if card.get("created_at"):
        lines.append(f"Registered: {str(card['created_at'])[:10]}")
    return "\n".join(lines)


def _assign_radiologist_for_study(scan_type: str) -> str:
    return radiologist_for_study(scan_type)


def _generate_radiology_report_findings(scan_type: str, patient_name: str) -> str:
    when = datetime.now().strftime("%Y-%m-%d %H:%M")
    study = (scan_type or "Diagnostic imaging").strip()
    acc = datetime.now().strftime("%Y%m%d%H%M%S")
    prefix = (
        f"CURIVA RADIOLOGY REPORT (demo generated text)\n"
        f"Patient: {patient_name}\nStudy: {study}\nReport date: {when}\nAccession: MF-RAD-{acc}\n\n"
        f"--- TECHNIQUE & CLINICAL DATA ---\n"
    )
    s = study.lower()
    if "ultrasound" in s:
        body = (
            "Ultrasound: Real-time grayscale imaging with spectral Doppler as indicated.\n\n"
            "FINDINGS: Organ contours and echotexture grossly preserved for this simulated acquisition. "
            "No large fluid collection or mass identified on the representative frames captured in the demo viewer.\n\n"
            "IMPRESSION: Essentially unremarkable limited ultrasound (demo narrative). Correlate with symptoms and lab tests.\n"
        )
    elif "x-ray" in s or "xray" in s or "radiograph" in s or "chest" in s:
        body = (
            "Radiography: Upright digital chest (simulated).\n\n"
            "FINDINGS: Lungs clear without focal airspace opacity. No pleural effusion or pneumothorax. "
            "Cardiomediastinal silhouette within normal limits for this template.\n\n"
            "IMPRESSION: No acute cardiopulmonary process (demo read).\n"
        )
    elif "mri" in s:
        body = (
            "MRI: Brain protocol without intravenous contrast (simulated).\n\n"
            "FINDINGS: No large territorial infarct, hemorrhage, or extra-axial collection described on sample sequences. "
            "Midline structures maintained.\n\n"
            "IMPRESSION: MRI brain without acute intracranial abnormality on this demo reconstruction set.\n"
        )
    elif " ct" in f" {s}" or s.startswith("ct"):
        body = (
            "CT: Helical acquisition with multiplanar reconstructions (simulated).\n\n"
            "FINDINGS: No acute intra-thoracic or intra-abdominal abnormality identified on this non-diagnostic sample.\n\n"
            "IMPRESSION: CT without acute finding (demo). DLP recorded per institutional policy.\n"
        )
    else:
        body = (
            "FINDINGS: Study completed per standard protocol. No acute abnormality identified in this auto-generated narrative.\n\n"
            "IMPRESSION: Routine imaging — interpret together with laboratory data and examination.\n"
        )
    footer = (
        "\n---\nDisclaimer: This document is auto-generated for software demonstration only and "
        "does not replace interpretation by a licensed radiologist or official PACS output."
    )
    return prefix + body + footer


# Pydantic Schemas
class IntakeRequest(BaseModel):
    name: str
    age: int
    gender: str
    symptoms: str
    notes: Optional[str] = ""

class RAGRequest(BaseModel):
    query: str


class PatientTestReportCreate(BaseModel):
    title: str
    lab_name: str = ""
    items: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    status: str = "Scheduled"
    result_summary: str = ""


class AppointmentCreate(BaseModel):
    title: str
    care_team: str = ""
    location: str = ""
    scheduled_at: str
    status: str = "Scheduled"
    notes: str = ""


class PatientImagingScanCreate(BaseModel):
    scan_type: str
    priority: str = "Routine"
    mark_completed: bool = True


@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/")
def read_root():
    return {"status": "running", "service": "Curiva API"}

# 1. Multi-Agent Patient Intake Pipeline
@app.post("/api/intake")
def register_patient(payload: IntakeRequest):
    result = orchestrator.run_intake_pipeline(
        name=payload.name,
        age=payload.age,
        gender=payload.gender,
        symptoms=payload.symptoms,
        notes=payload.notes
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail="Intake pipeline execution failed.")
    return result

# 2. Patients Lists & EHR Retrieval
@app.get("/api/patients")
def get_patients(for_doctor_id: Optional[int] = Query(None, description="If set, return only patients assigned to this doctor user id")):
    conn = get_db_conn()
    cursor = conn.cursor()
    if for_doctor_id is not None:
        cursor.execute(
            "SELECT * FROM patients WHERE primary_care_doctor_id = ? ORDER BY id DESC",
            (for_doctor_id,),
        )
    else:
        cursor.execute("SELECT * FROM patients ORDER BY id DESC")
    patients = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return patients


@app.delete("/api/patients")
def delete_all_patients_registry(actor_id: int = Query(..., description="Authenticated clinician user id")):
    """
    Remove every patient row and related clinical data (CASCADE). Unlinks all portal users from patient_id.
    Doctor-only; irreversible.
    """
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, role FROM users WHERE id = ?", (actor_id,))
    actor = cursor.fetchone()
    if not actor or not _role_is_clinic_or_hospital_admin(dict(actor).get("role")):
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="Only clinical staff or hospital management can clear the patient registry.",
        )

    cursor.execute("SELECT COUNT(*) FROM patients")
    total = int(cursor.fetchone()[0])
    if total == 0:
        conn.close()
        return {"success": True, "deleted": 0}

    cursor.execute("UPDATE users SET patient_id = NULL WHERE patient_id IS NOT NULL")
    cursor.execute("DELETE FROM patients")
    conn.commit()
    conn.close()
    return {"success": True, "deleted": total}


@app.get("/api/patients/qr/{qr_token}")
def lookup_patient_by_qr(qr_token: str):
    """Resolve a scanned QR token to basic patient record info (demo hospital check-in)."""
    token = (qr_token or "").strip()
    if not token:
        raise HTTPException(status_code=422, detail="QR token is required")

    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM patients WHERE qr_token = ?", (token,))
    patient = cursor.fetchone()
    if not patient:
        conn.close()
        raise HTTPException(status_code=404, detail="No patient found for this QR token")

    patient_dict = _ensure_patient_qr_token(cursor, patient)
    linked_user = _patient_linked_user(cursor, patient_dict["id"])
    qr_card = _build_patient_qr_card(patient_dict, linked_user)
    conn.commit()
    conn.close()
    return {"success": True, "qr_card": qr_card, "qr_text": _patient_qr_text(qr_card)}


@app.get("/api/patients/{patient_id}")
def get_patient_detail(patient_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    
    # Patient info
    cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
    patient = cursor.fetchone()
    if not patient:
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_dict = _ensure_patient_qr_token(cursor, patient)
    linked_user = _patient_linked_user(cursor, patient_id)
    qr_card = _build_patient_qr_card(patient_dict, linked_user)
    qr_text = _patient_qr_text(qr_card)
        
    # Clinical Summary
    cursor.execute("SELECT * FROM clinical_summaries WHERE patient_id = ?", (patient_id,))
    summary = cursor.fetchone()
    
    # Imaging info
    cursor.execute("SELECT * FROM imaging_scans WHERE patient_id = ?", (patient_id,))
    scans = [dict(s) for s in cursor.fetchall()]

    conn.commit()
    conn.close()
    
    # Generate mock HL7/FHIR dynamically if clinical summary exists
    hl7_msg = ""
    fhir_res = {}
    if summary:
        hl7_msg = (
            f"MSH|^~\\&|CURIVA|HOSPITAL|EHR_SYSTEM|DATABASE|{datetime.now().strftime('%Y%m%d%H%M%S')}||ORU^R01|MSG00001|P|2.5\r"
            f"PID|1||{patient_dict['id']}||{patient_dict['name']}||{patient_dict['created_at'][:10]}|{patient_dict['gender']}\r"
            f"OBR|1|||DIAGNOSTIC_SUMMARY|||{datetime.now().strftime('%Y%m%d%H%M%S')}\r"
            f"OBX|1|TX|CLINICAL_SUMMARY||{summary['summary']}|||F\r"
        )
        fhir_res = {
            "resourceType": "Patient",
            "id": str(patient_dict["id"]),
            "active": True,
            "name": [{"use": "official", "text": patient_dict["name"]}],
            "gender": patient_dict["gender"].lower(),
            "diagnosis_summary": summary["summary"],
            "meta": {
                "lastUpdated": summary["updated_at"],
                "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
            }
        }
        
    return {
        "patient": patient_dict,
        "summary": dict(summary) if summary else None,
        "scans": scans,
        "hl7": hl7_msg,
        "fhir": fhir_res,
        "qr_card": qr_card,
        "qr_text": qr_text,
    }


@app.delete("/api/patients/{patient_id}")
def delete_patient_registry_record(patient_id: int, actor_id: int = Query(..., description="Authenticated clinician user id")):
    """
    Remove a patient and related clinical data from the registry (CASCADE on child tables).
    Portal users linked to this patient_id are unlinked; requires doctor role.
    """
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, role FROM users WHERE id = ?", (actor_id,))
    actor = cursor.fetchone()
    if not actor or not _role_is_clinic_or_hospital_admin(dict(actor).get("role")):
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="Only clinical staff or hospital management can remove patients from the registry.",
        )

    cursor.execute("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")

    cursor.execute("UPDATE users SET patient_id = NULL WHERE patient_id = ?", (patient_id,))
    cursor.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
    conn.commit()
    conn.close()
    return {"success": True, "id": patient_id}


@app.get("/api/patients/{patient_id}/appointments")
def get_patient_appointments(patient_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    cursor.execute(
        "SELECT * FROM appointments WHERE patient_id = ? ORDER BY datetime(scheduled_at) DESC, id DESC",
        (patient_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


@app.post("/api/patients/{patient_id}/appointments")
def create_patient_appointment(patient_id: int, payload: AppointmentCreate):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    title = (payload.title or "").strip()
    if not title:
        conn.close()
        raise HTTPException(status_code=400, detail="title is required")
    sched = (payload.scheduled_at or "").strip()
    if not sched:
        conn.close()
        raise HTTPException(status_code=400, detail="scheduled_at is required")
    cursor.execute(
        """
        INSERT INTO appointments (patient_id, title, care_team, location, scheduled_at, status, notes)
        VALUES (?,?,?,?,?,?,?)
        """,
        (
            patient_id,
            title,
            (payload.care_team or "").strip(),
            (payload.location or "").strip(),
            sched,
            (payload.status or "Scheduled").strip(),
            (payload.notes or "").strip(),
        ),
    )
    aid = cursor.lastrowid
    conn.commit()
    cursor.execute("SELECT * FROM appointments WHERE id = ?", (aid,))
    row = dict(cursor.fetchone())
    conn.close()
    return {"success": True, "appointment": row}


@app.get("/api/patients/{patient_id}/test-reports")
def list_patient_test_reports(patient_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    cursor.execute(
        "SELECT * FROM patient_test_reports WHERE patient_id = ? ORDER BY datetime(created_at) DESC, id DESC",
        (patient_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


@app.post("/api/patients/{patient_id}/test-reports")
def create_patient_test_report(patient_id: int, payload: PatientTestReportCreate):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    created_at = datetime.now().isoformat()
    sched = (payload.scheduled_at or "").strip() or created_at
    items_json = json.dumps(payload.items or [])
    cursor.execute(
        """
        INSERT INTO patient_test_reports (patient_id, title, lab_name, items_json, scheduled_at, status, result_summary, created_at)
        VALUES (?,?,?,?,?,?,?,?)
        """,
        (
            patient_id,
            payload.title.strip(),
            (payload.lab_name or "").strip(),
            items_json,
            sched,
            (payload.status or "Scheduled").strip(),
            (payload.result_summary or "").strip(),
            created_at,
        ),
    )
    rid = cursor.lastrowid
    conn.commit()
    cursor.execute("SELECT * FROM patient_test_reports WHERE id = ?", (rid,))
    row = dict(cursor.fetchone())
    conn.close()
    return {"success": True, "report": row}


@app.get("/api/patients/{patient_id}/payments")
def list_patient_chart_payments(patient_id: int):
    """All billing for portal accounts linked to this patient chart (supports duplicate logins)."""
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    cursor.execute(
        """
        SELECT p.* FROM payments p
        JOIN users u ON u.id = p.user_id
        WHERE u.patient_id = ?
        ORDER BY p.id DESC
        """,
        (patient_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


@app.post("/api/patients/{patient_id}/imaging-scans")
def create_patient_imaging_scan(patient_id: int, payload: PatientImagingScanCreate):
    """Patient-initiated imaging order with auto-generated demo radiology narrative stored on the scan row."""
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
    prow = cursor.fetchone()
    if not prow:
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    patient = dict(prow)
    study = (payload.scan_type or "").strip()
    if not study:
        conn.close()
        raise HTTPException(status_code=400, detail="scan_type is required")
    rad = _assign_radiologist_for_study(study)
    report = _generate_radiology_report_findings(study, patient["name"])
    now = datetime.now().isoformat()
    status = "Completed" if payload.mark_completed else "Pending"
    pri = (payload.priority or "Routine").strip()
    cursor.execute(
        """
        INSERT INTO imaging_scans (patient_id, scan_type, priority, assigned_radiologist, scheduled_time, status, report_findings)
        VALUES (?,?,?,?,?,?,?)
        """,
        (patient_id, study, pri, rad, now, status, report),
    )
    sid = cursor.lastrowid
    conn.commit()
    cursor.execute("SELECT * FROM imaging_scans WHERE id = ?", (sid,))
    row = dict(cursor.fetchone())
    conn.close()
    return {"success": True, "scan": row}


# 3. Imaging Workflow Routes
@app.get("/api/imaging")
def get_imaging_scans():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.*, p.name as patient_name, p.severity as patient_severity 
        FROM imaging_scans s
        JOIN patients p ON s.patient_id = p.id
        ORDER BY s.id DESC
    """)
    scans = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return scans

@app.post("/api/imaging/{scan_id}/complete")
def complete_scan(scan_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE imaging_scans SET status = 'Completed' WHERE id = ?", (scan_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Scan status updated to Completed"}

# 4. Tasks Routes
@app.get("/api/tasks")
def get_tasks():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, p.name as patient_name 
        FROM tasks t
        LEFT JOIN patients p ON t.patient_id = p.id
        ORDER BY t.id DESC
    """)
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tasks

# 5. Alerts Routes
@app.get("/api/alerts")
def get_alerts():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*, p.name as patient_name
        FROM alerts a
        LEFT JOIN patients p ON a.patient_id = p.id
        ORDER BY a.resolved ASC, a.id DESC
    """)
    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return alerts

@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET resolved = 1 WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Alert resolved"}

# 6. RAG Queries
@app.post("/api/rag/query")
def query_rag(payload: RAGRequest):
    return rag_service.answer_query(payload.query)

# 7. RL Optimizer Control
@app.post("/api/rl/train")
def train_rl_agent(episodes: Optional[int] = 150):
    # Train the Q-learning agent, saving progress to SQLite
    hist = rl_agent.train(episodes=episodes)
    return {"success": True, "final_reward": hist[-1]["reward"], "episodes_trained": len(hist)}

@app.get("/api/rl/metrics")
def get_rl_metrics():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM rl_metrics ORDER BY episode ASC")
    metrics = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return metrics

@app.get("/api/rl/compare")
def compare_rl_policies():
    comparison = rl_agent.evaluate_policies(num_episodes=20)
    return comparison

# 8. Hospital Stats (Dashboard KPIs)
@app.get("/api/stats")
def get_hospital_stats():
    conn = get_db_conn()
    cursor = conn.cursor()
    
    # Total patient count
    cursor.execute("SELECT COUNT(*) FROM patients")
    total_patients = cursor.fetchone()[0]
    
    # Severity breakdown
    cursor.execute("SELECT severity, COUNT(*) FROM patients GROUP BY severity")
    severity_breakdown = {row[0]: row[1] for row in cursor.fetchall()}
    
    # Active alerts
    cursor.execute("SELECT COUNT(*) FROM alerts WHERE resolved = 0")
    active_alerts = cursor.fetchone()[0]
    
    # Pending scans count
    cursor.execute("SELECT COUNT(*) FROM imaging_scans WHERE status = 'Pending'")
    pending_scans = cursor.fetchone()[0]
    
    # Average patient risk score
    cursor.execute("SELECT AVG(risk_score) FROM clinical_summaries")
    avg_risk = cursor.fetchone()[0]
    avg_risk = round(avg_risk, 1) if avg_risk is not None else 0.0
    
    # Open tasks
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = 'Pending'")
    pending_tasks = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "total_patients": total_patients,
        "active_alerts": active_alerts,
        "pending_scans": pending_scans,
        "average_risk_score": avg_risk,
        "pending_tasks": pending_tasks,
        "severity_breakdown": {
            "Critical": severity_breakdown.get("Critical", 0),
            "Urgent": severity_breakdown.get("Urgent", 0),
            "Medium": severity_breakdown.get("Medium", 0),
            "Low": severity_breakdown.get("Low", 0)
        }
    }

# ── Authentication Schemas & Routes ──────────────────────────────────────────


def _gmail_identity(email: str) -> Optional[str]:
    """
    Canonical identity for consumer Gmail / Googlemail addresses: ignores dots in the
    local part and strips +tags (same rules Google uses for delivery). Returns None if
    the address is not @gmail.com or @googlemail.com.
    """
    raw = (email or "").strip().lower()
    if "@" not in raw:
        return None
    local, _, domain = raw.rpartition("@")
    if not local:
        return None
    if domain == "googlemail.com":
        domain = "gmail.com"
    if domain != "gmail.com":
        return None
    if "+" in local:
        local = local.split("+", 1)[0]
    local = local.replace(".", "")
    if not local:
        return None
    return f"{local}@{domain}"


_APPLE_MAIL_DOMAINS = frozenset({"icloud.com", "me.com", "mac.com", "privaterelay.appleid.com"})


def _apple_mail_identity(email: str) -> Optional[str]:
    """
    Canonical identity for Apple ID email domains (iCloud / legacy MobileMe / Mac).
    Strips +tags on the local part (subaddressing); does not apply Gmail-style dot rules.
    """
    raw = (email or "").strip().lower()
    if "@" not in raw:
        return None
    local, _, domain = raw.rpartition("@")
    if not local or domain not in _APPLE_MAIL_DOMAINS:
        return None
    if "+" in local:
        local = local.split("+", 1)[0]
    if not local:
        return None
    return f"{local}@{domain}"


def _demo_consumer_alias_match(identifier: str) -> bool:
    """True if login id is a consumer Gmail/Googlemail or Apple Mail address (demo alias rules apply)."""
    return bool(_gmail_identity(identifier) or _apple_mail_identity(identifier))


def _gather_login_candidate_rows(cursor: sqlite3.Cursor, identifier: str) -> List[sqlite3.Row]:
    """
    Rows that might match this login identifier. Username match returns at most one row.
    Email matches return every user with that email (case-insensitive) so duplicate emails
    can be disambiguated by password.
    """
    ident = (identifier or "").strip()
    if not ident:
        return []
    cursor.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1", (ident,))
    row = cursor.fetchone()
    if row:
        return [row]
    if "@" in ident:
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (ident,))
        return list(cursor.fetchall())
    return []


class LoginRequest(BaseModel):
    username: str
    password: str
    site_city: Optional[str] = None
    site_hospital: Optional[str] = None

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str
    full_name: str
    email: str
    patient_id: Optional[int] = None
    site_city: Optional[str] = None
    site_hospital: Optional[str] = None

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    username = (payload.username or "").strip()
    password = payload.password or ""
    if not username or not password:
        raise HTTPException(status_code=422, detail="Username and password are required")

    conn = get_db_conn()
    cursor = conn.cursor()
    candidates = _gather_login_candidate_rows(cursor, username)

    if not candidates:
        want_g = _gmail_identity(username)
        want_a = _apple_mail_identity(username)
        if want_g or want_a:
            cursor.execute(
                """
                SELECT * FROM users
                WHERE email IS NOT NULL
                  AND (
                    LOWER(email) GLOB '*@gmail.com'
                    OR LOWER(email) GLOB '*@googlemail.com'
                    OR LOWER(email) GLOB '*@icloud.com'
                    OR LOWER(email) GLOB '*@me.com'
                    OR LOWER(email) GLOB '*@mac.com'
                    OR LOWER(email) GLOB '*@privaterelay.appleid.com'
                  )
                """
            )
            for row in cursor.fetchall():
                em = dict(row).get("email") or ""
                if want_g and _gmail_identity(em) == want_g:
                    candidates.append(row)
                elif want_a and _apple_mail_identity(em) == want_a:
                    candidates.append(row)

    if not candidates and _demo_consumer_alias_match(username):
        # Demo: consumer Gmail / Apple Mail + password of any patient account (not only "patient1").
        hashed_try = hash_password(password)
        cursor.execute("SELECT * FROM users WHERE role = 'patient' ORDER BY id")
        for row in cursor.fetchall():
            if dict(row).get("password_hash") == hashed_try:
                candidates.append(row)
                break

    hashed_pwd = hash_password(password)
    user_row = None
    for row in candidates:
        if dict(row).get("password_hash") == hashed_pwd:
            user_row = row
            break

    if not user_row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = dict(user_row)
    if user.get("approval_status") == "rejected":
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="This account was not approved for Curiva access. Please contact hospital staff.",
        )

    repair_patient_user_links(cursor)
    conn.commit()

    if payload.site_city is not None or payload.site_hospital is not None:
        sc = (payload.site_city or "").strip()
        sh = (payload.site_hospital or "").strip()
        cursor.execute(
            "UPDATE users SET site_city = ?, site_hospital = ? WHERE id = ?",
            (sc, sh, user["id"]),
        )
        conn.commit()

    cursor.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
    fresh_user = dict(cursor.fetchone())
    conn.close()
    fresh_user.pop("password_hash", None)
    return {"success": True, "user": fresh_user}


@app.get("/api/auth/user/{user_id}")
def get_user_public_profile(user_id: int):
    """Demo: safe fields only; runs patient_id repair so stale clients can resync after DB resets."""
    conn = get_db_conn()
    cursor = conn.cursor()
    repair_patient_user_links(cursor)
    conn.commit()
    cursor.execute(
        "SELECT id, username, role, full_name, email, patient_id, site_city, site_hospital, approval_status FROM users WHERE id = ?",
        (user_id,),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


@app.post("/api/auth/register")
def register(payload: RegisterRequest):
    username = (payload.username or "").strip()
    if not username:
        raise HTTPException(status_code=422, detail="Username is required")

    role = (payload.role or "").strip().lower()
    if role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Public registration is for patients only. Doctor accounts are created by a signed-in doctor from Register staff.",
        )

    conn = get_db_conn()
    cursor = conn.cursor()

    # Check if username exists (case-insensitive, matches login)
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")

    site_city = (payload.site_city or "").strip()
    site_hospital = (payload.site_hospital or "").strip()
    if not site_city or not site_hospital:
        conn.close()
        raise HTTPException(status_code=422, detail="City and hospital are required so your account is linked to a site.")

    hashed_pwd = hash_password(payload.password or "")
    created_at = datetime.now().isoformat()
    display_name = (payload.full_name or "").strip() or username

    try:
        new_pid = _insert_random_ehr_for_patient(cursor, display_name, site_city, site_hospital)
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, role, full_name, email, patient_id, site_city, site_hospital, created_at, approval_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
            """,
            (username, hashed_pwd, role, payload.full_name, payload.email, new_pid, site_city, site_hospital, created_at),
        )
        user_id = cursor.lastrowid

        conn.commit()

        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        new_user = dict(cursor.fetchone())
        new_user.pop("password_hash", None)
        conn.close()
        return {"success": True, "user": new_user}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


class ManagementRegisterRequest(BaseModel):
    """Register staff — requires a signed-in doctor or hospital manager (actor_id)."""
    actor_id: int
    username: str
    password: str
    role: str
    full_name: str
    email: str
    patient_id: Optional[int] = None
    site_city: Optional[str] = None
    site_hospital: Optional[str] = None


@app.post("/api/management/register-user")
def management_register_user(payload: ManagementRegisterRequest):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, role, site_city, site_hospital FROM users WHERE id = ?",
        (payload.actor_id,),
    )
    actor_row = cursor.fetchone()
    actor = dict(actor_row) if actor_row else {}
    if not actor_row or not _role_is_clinic_or_hospital_admin(actor.get("role")):
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="Doctor or hospital management session required to register accounts.",
        )

    role = (payload.role or "").strip().lower()
    if role not in ("doctor", "patient", "manager"):
        conn.close()
        raise HTTPException(status_code=400, detail="Role must be doctor, patient, or hospital management")

    if role == "manager" and (actor.get("role") or "").lower() != "doctor":
        conn.close()
        raise HTTPException(status_code=403, detail="Only a signed-in doctor can create hospital management accounts.")

    username = (payload.username or "").strip()
    if not username or not (payload.password or ""):
        conn.close()
        raise HTTPException(status_code=422, detail="Username and password are required")

    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_pwd = hash_password(payload.password)
    created_at = datetime.now().isoformat()
    pid = payload.patient_id if role == "patient" else None

    sc = ((payload.site_city or actor.get("site_city") or "") or "").strip()
    sh = ((payload.site_hospital or actor.get("site_hospital") or "") or "").strip()

    if role == "patient":
        if pid is not None:
            cursor.execute("SELECT id FROM patients WHERE id = ?", (pid,))
            if not cursor.fetchone():
                conn.close()
                raise HTTPException(status_code=400, detail="Patient record ID does not exist in the registry.")
        else:
            # Create a new EHR stub so the portal opens without a separate "link profile" step.
            display_name = (payload.full_name or "").strip() or username
            cursor.execute(
                """
                INSERT INTO patients (name, age, gender, symptoms, severity, status, created_at, site_city, site_hospital, qr_token)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (display_name, 18, "Unknown", None, "Low", "Registered", created_at, sc or None, sh or None, new_patient_qr_token()),
            )
            pid = cursor.lastrowid

    try:
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, role, full_name, email, patient_id, site_city, site_hospital, created_at, approval_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
            """,
            (username, hashed_pwd, role, payload.full_name, payload.email, pid, sc or None, sh or None, created_at),
        )
        user_id = cursor.lastrowid
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        new_user = dict(cursor.fetchone())
        new_user.pop("password_hash", None)
        conn.close()
        return {"success": True, "user": new_user}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


class VitalsInputRequest(BaseModel):
    heart_rate: Optional[int] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    blood_sugar: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None

@app.get("/api/patients/{patient_id}/vitals")
def get_patient_vitals(patient_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM health_vitals WHERE patient_id = ? ORDER BY id DESC", (patient_id,))
    vitals = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return vitals

@app.post("/api/patients/{patient_id}/vitals")
def record_patient_vitals(patient_id: int, payload: VitalsInputRequest):
    conn = get_db_conn()
    agent = HealthMonitorAgent()
    
    agent_payload = payload.dict()
    agent_payload["patient_id"] = patient_id
    
    result = agent.process(agent_payload, conn)
    conn.close()
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("log", "Failed to process vitals"))
    return result

# ── Diet Plans Schemas & Routes ──────────────────────────────────────────────

class DietInputRequest(BaseModel):
    condition: str
    veg_type: Optional[str] = "veg"

@app.get("/api/patients/{patient_id}/diet")
def get_patient_diet_plans(patient_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM diet_plans WHERE patient_id = ? ORDER BY id DESC", (patient_id,))
    rows = cursor.fetchall()
    conn.close()
    
    diet_plans = []
    for r in rows:
        d = dict(r)
        try:
            d["plan"] = json.loads(d["plan_json"])
        except:
            d["plan"] = d["plan_json"]
        diet_plans.append(d)
        
    return diet_plans

@app.post("/api/patients/{patient_id}/diet")
def generate_patient_diet_plan(patient_id: int, payload: DietInputRequest):
    conn = get_db_conn()
    agent = DietPlanAgent()
    
    agent_payload = {
        "patient_id": patient_id,
        "condition": payload.condition,
        "veg_type": payload.veg_type
    }
    
    result = agent.process(agent_payload, conn)
    conn.close()
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("log", "Failed to process diet plan"))
    return result

# ── Disease Protocols Routes ──────────────────────────────────────────────────

@app.get("/api/protocols")
def get_disease_protocols():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM disease_protocols ORDER BY category, name")
    protocols = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return protocols

@app.get("/api/protocols/{name}")
def get_disease_protocol_detail(name: str):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM disease_protocols WHERE name = ? OR name LIKE ?", (name, f"%{name}%"))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return dict(row)

# ── Payments (billing) ───────────────────────────────────────────────────────

ALLOWED_PAY_METHODS = frozenset({"card", "upi", "netbanking"})


class PaymentCreate(BaseModel):
    user_id: int
    amount_inr: float
    description: str
    method: str


@app.post("/api/payments")
def create_payment(payload: PaymentCreate):
    if payload.amount_inr < 1 or payload.amount_inr > 500_000:
        raise HTTPException(status_code=400, detail="Amount must be between 1 and 500000 INR")
    raw = (payload.method or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="method is required")
    base = raw.split(":", 1)[0].strip().lower()
    if base not in ALLOWED_PAY_METHODS:
        raise HTTPException(status_code=400, detail="method must start with: card, upi, or netbanking")
    m = raw[:240]
    desc = (payload.description or "").strip()
    if len(desc) < 2:
        raise HTTPException(status_code=400, detail="Description is required")

    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (payload.user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    reference_id = f"MF-PAY-{secrets.token_hex(4).upper()}"
    created_at = datetime.now().isoformat()
    amount = round(float(payload.amount_inr), 2)
    cursor.execute(
        """
        INSERT INTO payments (user_id, amount_inr, description, method, status, reference_id, created_at)
        VALUES (?, ?, ?, ?, 'completed', ?, ?)
        """,
        (payload.user_id, amount, desc, m, reference_id, created_at),
    )
    pid = cursor.lastrowid
    conn.commit()
    cursor.execute("SELECT * FROM payments WHERE id = ?", (pid,))
    row = dict(cursor.fetchone())
    conn.close()
    return {"success": True, "payment": row}


@app.get("/api/payments")
def list_user_payments(user_id: int):
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    cursor.execute(
        "SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC",
        (user_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


@app.get("/api/payments/ledger")
def list_payment_ledger(limit: int = 50):
    lim = max(1, min(limit, 200))
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT p.*, u.username, u.full_name, u.role
        FROM payments p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.id DESC
        LIMIT ?
        """,
        (lim,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows
