import json
import re
from datetime import datetime

from app.db import new_patient_qr_token
from app.indian_doctors import RADIOLOGIST_FALLBACK, RADIOLOGISTS_BY_SCAN_KEY

class BaseAgent:
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role

    def process(self, payload: dict, db_conn) -> dict:
        raise NotImplementedError("Each agent must implement the process method.")

class PatientIntakeAgent(BaseAgent):
    def __init__(self):
        super().__init__("Patient Intake Agent", "Collects patient symptoms and records initial triage")

    def process(self, payload: dict, db_conn) -> dict:
        # Triage logic based on symptoms
        symptoms = payload.get("symptoms", "").lower()
        name = payload.get("name", "Unknown Patient")
        age = payload.get("age", 35)
        gender = payload.get("gender", "Other")
        
        severity = "Low"
        if any(term in symptoms for term in ["chest pain", "shortness of breath", "unconscious", "stroke", "bleeding", "cardiac"]):
            severity = "Critical"
        elif ("abdominal" in symptoms and "pain" in symptoms) or any(term in symptoms for term in ["fever", "fracture", "breathing", "appendicitis"]):
            severity = "Urgent"
        elif any(term in symptoms for term in ["cough", "dizziness", "vomiting", "headache", "migraine", "nausea"]):
            severity = "Medium"
            
        cursor = db_conn.cursor()
        created_at = datetime.now().isoformat()
        
        # Insert Patient
        cursor.execute(
            "INSERT INTO patients (name, age, gender, symptoms, severity, status, created_at, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (name, age, gender, symptoms, severity, "Intake", created_at, new_patient_qr_token()),
        )
        patient_id = cursor.lastrowid
        db_conn.commit()
        
        log_message = f"Registered patient {name} (ID: {patient_id}) with {severity} severity based on symptoms: '{symptoms}'."
        
        return {
            "success": True,
            "patient_id": patient_id,
            "severity": severity,
            "log": log_message,
            "next_agent": "Clinical Summary Agent" if len(symptoms) > 0 else "Task Planner Agent"
        }

class ClinicalSummaryAgent(BaseAgent):
    def __init__(self):
        super().__init__("Clinical Summary Agent", "Summarizes reports and extracts diagnoses using clinical heuristics")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        notes = payload.get("notes", "")
        
        cursor = db_conn.cursor()
        if not notes:
            # Fallback: get symptoms if no special doctor notes uploaded
            cursor.execute("SELECT symptoms, severity FROM patients WHERE id = ?", (patient_id,))
            row = cursor.fetchone()
            notes = row["symptoms"] if row else ""
            
        notes_lower = notes.lower()
        diagnoses = []
        risk_score = 10
        
        # Diagnosis Extraction Rules (NLP Sim)
        if any(term in notes_lower for term in ["chest pain", "heart", "myocardial"]):
            diagnoses.append("Suspected Acute Coronary Syndrome (ICD-10 I24.9)")
            risk_score = 90
        if any(term in notes_lower for term in ["cough", "fever", "lung", "pneumonia"]):
            diagnoses.append("Suspected Pneumonia (ICD-10 J18.9)")
            risk_score = 65
        if any(term in notes_lower for term in ["abdominal pain", "appendix", "nausea"]):
            diagnoses.append("Suspected Acute Appendicitis (ICD-10 K35.8)")
            risk_score = 80
        if any(term in notes_lower for term in ["headache", "migraine"]):
            diagnoses.append("Migraine (ICD-10 G43.9)")
            risk_score = 30
        if any(term in notes_lower for term in ["fracture", "broken bone", "fall"]):
            diagnoses.append("Bone Fracture (ICD-10 M84.3)")
            risk_score = 45
            
        if not diagnoses:
            diagnoses.append("General Clinical Assessment Pending (ICD-10 Z00.0)")
            risk_score = 20
            
        # Clinical Summarization
        summary_text = (
            f"Patient presents with {notes}. Initial clinical evaluation suggests: "
            f"{', '.join(diagnoses)}. Recommended observation and follow-up."
        )
        
        # Upsert Clinical Summary
        cursor.execute(
            "INSERT OR REPLACE INTO clinical_summaries (patient_id, summary, diagnoses, risk_score, updated_at) VALUES (?, ?, ?, ?, ?)",
            (patient_id, summary_text, ",".join(diagnoses), risk_score, datetime.now().isoformat())
        )
        db_conn.commit()
        
        # Check if imaging is required
        needs_imaging = False
        scan_type = None
        if any(term in notes_lower for term in ["fracture", "broken", "head trauma", "abdominal pain", "chest pain", "mri", "ct", "x-ray"]):
            needs_imaging = True
            if any(term in notes_lower for term in ["head trauma", "stroke", "mri"]):
                scan_type = "MRI"
            elif any(term in notes_lower for term in ["abdominal pain", "ct"]):
                scan_type = "CT"
            else:
                scan_type = "X-Ray"
                
        log_message = f"Clinical summary generated for Patient ID {patient_id}. Identified: {', '.join(diagnoses)}. Risk Score: {risk_score}."
        
        return {
            "success": True,
            "patient_id": patient_id,
            "summary": summary_text,
            "diagnoses": diagnoses,
            "risk_score": risk_score,
            "needs_imaging": needs_imaging,
            "scan_type": scan_type,
            "log": log_message,
            "next_agent": "Imaging Workflow Agent" if needs_imaging else "EHR Agent"
        }

class ImagingWorkflowAgent(BaseAgent):
    def __init__(self):
        super().__init__("Imaging Workflow Agent", "Manages MRI, CT, and X-Ray scan schedules")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        scan_type = payload.get("scan_type", "X-Ray")
        severity = payload.get("severity", "Medium")
        
        # Map severity to priority
        priority = "Routine"
        if severity == "Critical":
            priority = "Emergency"
        elif severity == "Urgent":
            priority = "Urgent"
            
        # Assign simulated radiologist
        radiologists = RADIOLOGISTS_BY_SCAN_KEY
        assigned_radiologist = radiologists.get(scan_type, RADIOLOGIST_FALLBACK)
        
        # Schedule simulated time (Emergency gets immediate slots, others staggered)
        scheduled_time = datetime.now()
        if priority == "Emergency":
            time_str = "Immediate (Within 15 mins)"
        elif priority == "Urgent":
            time_str = "Scheduled: Today (Within 2 hours)"
        else:
            time_str = "Scheduled: Tomorrow morning"
            
        cursor = db_conn.cursor()
        cursor.execute(
            "INSERT INTO imaging_scans (patient_id, scan_type, priority, assigned_radiologist, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)",
            (patient_id, scan_type, priority, assigned_radiologist, time_str, "Pending")
        )
        db_conn.commit()
        
        log_message = f"Scheduled {priority} {scan_type} scan for Patient ID {patient_id} with {assigned_radiologist}. Time slot: {time_str}."
        
        return {
            "success": True,
            "patient_id": patient_id,
            "scan_type": scan_type,
            "priority": priority,
            "radiologist": assigned_radiologist,
            "scheduled_time": time_str,
            "log": log_message,
            "next_agent": "EHR Agent"
        }

class EHRAgent(BaseAgent):
    def __init__(self):
        super().__init__("EHR Agent", "Synchronizes patient summaries and generates HL7/FHIR compliance records")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        
        cursor = db_conn.cursor()
        # Retrieve patient information
        cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
        patient = cursor.fetchone()
        
        # Retrieve clinical summary
        cursor.execute("SELECT * FROM clinical_summaries WHERE patient_id = ?", (patient_id,))
        summary = cursor.fetchone()
        
        if not patient:
            return {"success": False, "log": "Patient record not found in database."}
            
        # Generate HL7 v2 Message (ORU_R01 Observational Report)
        hl7_message = (
            f"MSH|^~\\&|CURIVA|HOSPITAL|EHR_SYSTEM|DATABASE|{datetime.now().strftime('%Y%m%d%H%M%S')}||ORU^R01|MSG00001|P|2.5\r"
            f"PID|1||{patient['id']}||{patient['name']}||{patient['created_at'][:10]}|{patient['gender']}\r"
            f"OBR|1|||DIAGNOSTIC_SUMMARY|||{datetime.now().strftime('%Y%m%d%H%M%S')}\r"
            f"OBX|1|TX|CLINICAL_SUMMARY||{summary['summary'] if summary else 'No Summary'}|||F\r"
        )
        
        # Generate FHIR Patient Resource JSON
        fhir_resource = {
            "resourceType": "Patient",
            "id": str(patient["id"]),
            "active": True,
            "name": [{"use": "official", "text": patient["name"]}],
            "gender": "male" if patient["gender"].lower() == "male" else "female",
            "diagnosis_summary": summary["summary"] if summary else "None",
            "meta": {
                "lastUpdated": datetime.now().isoformat(),
                "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
            }
        }
        
        # Update patient status to EHR_Update
        cursor.execute("UPDATE patients SET status = 'EHR_Updated' WHERE id = ?", (patient_id,))
        db_conn.commit()
        
        log_message = f"EHR synchronization complete. HL7 Message & FHIR records successfully updated for patient ID {patient_id}."
        
        return {
            "success": True,
            "patient_id": patient_id,
            "hl7": hl7_message,
            "fhir": fhir_resource,
            "log": log_message,
            "next_agent": "Alert Agent"
        }

class AlertAgent(BaseAgent):
    def __init__(self):
        super().__init__("Alert Agent", "Triggers high-priority emergency alerts and notifications")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        
        cursor = db_conn.cursor()
        cursor.execute("SELECT name, severity FROM patients WHERE id = ?", (patient_id,))
        patient = cursor.fetchone()
        
        cursor.execute("SELECT risk_score FROM clinical_summaries WHERE patient_id = ?", (patient_id,))
        summary = cursor.fetchone()
        
        if not patient:
            return {"success": False, "log": "Patient record not found."}
            
        severity = patient["severity"]
        risk_score = summary["risk_score"] if summary else 0
        
        triggered = False
        alert_level = "Info"
        message = ""
        
        if severity == "Critical" or risk_score >= 80:
            triggered = True
            alert_level = "Critical"
            message = f"EMERGENCY ALERT: Patient {patient['name']} (ID {patient_id}) requires immediate ICU/ER routing due to critical symptoms & high risk score ({risk_score})."
        elif severity == "Urgent" or risk_score >= 50:
            triggered = True
            alert_level = "Warning"
            message = f"WARNING: Patient {patient['name']} (ID {patient_id}) requires prioritized radiology/clinic scheduling (Risk score: {risk_score})."
        else:
            message = f"System Notification: Patient {patient['name']} (ID {patient_id}) intake flow finalized smoothly."
            
        if triggered:
            cursor.execute(
                "INSERT INTO alerts (patient_id, level, message, timestamp, resolved) VALUES (?, ?, ?, ?, 0)",
                (patient_id, alert_level, message, datetime.now().isoformat())
            )
            db_conn.commit()
            log_message = f"ALERT CREATED: [{alert_level}] {message}"
        else:
            log_message = f"No emergency alert triggered for patient ID {patient_id} (Status stable)."
            
        return {
            "success": True,
            "patient_id": patient_id,
            "alert_triggered": triggered,
            "alert_level": alert_level,
            "message": message,
            "log": log_message,
            "next_agent": "Analytics Agent"
        }

class TaskPlannerAgent(BaseAgent):
    def __init__(self):
        super().__init__("Task Planner Agent", "Assigns tasks dynamically to optimize workflows")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        details = payload.get("details", "Follow up scheduled")
        assigned_to = payload.get("assign_to", "Primary Care Physician")
        
        cursor = db_conn.cursor()
        cursor.execute(
            "INSERT INTO tasks (assigned_to, task_type, status, details, patient_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (assigned_to, "Follow-Up Care", "Pending", details, patient_id, datetime.now().isoformat())
        )
        db_conn.commit()
        
        log_message = f"Task Planner assigned a new post-discharge follow-up task to {assigned_to} for Patient ID {patient_id}."
        
        return {
            "success": True,
            "patient_id": patient_id,
            "assigned_to": assigned_to,
            "log": log_message,
            "next_agent": None
        }

class AnalyticsAgent(BaseAgent):
    def __init__(self):
        super().__init__("Analytics Agent", "Analyzes queue performance and coordinates with the RL optimizer")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        
        cursor = db_conn.cursor()
        # Fetch stats to calculate simulated bottlenecks
        cursor.execute("SELECT COUNT(*) FROM patients")
        total_patients = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM imaging_scans WHERE status = 'Pending'")
        pending_scans = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM alerts WHERE resolved = 0")
        active_alerts = cursor.fetchone()[0]
        
        # Calculate simulated bottlenecks
        bottleneck_status = "Green"
        if pending_scans > 5 or active_alerts > 2:
            bottleneck_status = "Red (Imaging Queue Overloaded)"
        elif pending_scans > 2 or active_alerts > 0:
            bottleneck_status = "Yellow (High Load)"
            
        # Complete patient status
        cursor.execute("UPDATE patients SET status = 'Complete' WHERE id = ?", (patient_id,))
        db_conn.commit()
        
        log_message = (
            f"Analytics Summary: Patient ID {patient_id} workflow completed. "
            f"Total Hospital Load: {total_patients} patients. Pending scans: {pending_scans}. "
            f"Current system bottleneck state: {bottleneck_status}."
        )
        
        return {
            "success": True,
            "patient_id": patient_id,
            "bottleneck": bottleneck_status,
            "log": log_message,
            "next_agent": "Task Planner Agent"
        }

class HealthMonitorAgent(BaseAgent):
    def __init__(self):
        super().__init__("Health Monitor Agent", "Monitors patient vitals and flags clinical anomalies")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        heart_rate = payload.get("heart_rate")
        systolic_bp = payload.get("systolic_bp")
        diastolic_bp = payload.get("diastolic_bp")
        spo2 = payload.get("spo2")
        temperature = payload.get("temperature")
        blood_sugar = payload.get("blood_sugar")
        weight = payload.get("weight")
        height = payload.get("height")

        # Basic validations
        if not patient_id:
            return {"success": False, "log": "Patient ID is required for health monitoring"}

        # Calculate BMI
        bmi = None
        if weight and height:
            bmi = round(weight / ((height / 100.0) ** 2), 2)

        # Evaluate Vitals status
        status = "Normal"
        anomalies = []

        if spo2 is not None:
            if spo2 < 90:
                status = "Critical"
                anomalies.append(f"Severe hypoxia (SpO2: {spo2}%)")
            elif spo2 < 95:
                if status != "Critical": status = "Warning"
                anomalies.append(f"Mild hypoxia (SpO2: {spo2}%)")

        if heart_rate is not None:
            if heart_rate > 120 or heart_rate < 50:
                status = "Critical"
                anomalies.append(f"Abnormal heart rate (HR: {heart_rate} bpm)")
            elif heart_rate > 100 or heart_rate < 60:
                if status != "Critical": status = "Warning"
                anomalies.append(f"Borderline heart rate (HR: {heart_rate} bpm)")

        if systolic_bp is not None and diastolic_bp is not None:
            if systolic_bp > 160 or systolic_bp < 85 or diastolic_bp > 100 or diastolic_bp < 50:
                status = "Critical"
                anomalies.append(f"Hypertensive crisis / hypotension (BP: {systolic_bp}/{diastolic_bp} mmHg)")
            elif systolic_bp > 130 or diastolic_bp > 85:
                if status != "Critical": status = "Warning"
                anomalies.append(f"Prehypertension (BP: {systolic_bp}/{diastolic_bp} mmHg)")

        if temperature is not None:
            if temperature > 103.0 or temperature < 95.0:
                status = "Critical"
                anomalies.append(f"Extreme temperature (Temp: {temperature}°F)")
            elif temperature > 100.4 or temperature < 97.0:
                if status != "Critical": status = "Warning"
                anomalies.append(f"Fever / low temp (Temp: {temperature}°F)")

        if blood_sugar is not None:
            if blood_sugar > 200 or blood_sugar < 60:
                status = "Critical"
                anomalies.append(f"Critical blood sugar (Glucose: {blood_sugar} mg/dL)")
            elif blood_sugar > 140:
                if status != "Critical": status = "Warning"
                anomalies.append(f"Elevated blood sugar (Glucose: {blood_sugar} mg/dL)")

        # Save vitals
        cursor = db_conn.cursor()
        recorded_at = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO health_vitals (
                patient_id, heart_rate, systolic_bp, diastolic_bp, spo2, temperature, 
                blood_sugar, bmi, weight, height, status, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (patient_id, heart_rate, systolic_bp, diastolic_bp, spo2, temperature, blood_sugar, bmi, weight, height, status, recorded_at))
        vitals_id = cursor.lastrowid

        # Trigger Alerts if abnormal
        log_message = f"Vitals recorded for Patient ID {patient_id}. Status: {status}."
        if status != "Normal":
            alert_msg = f"Vitals Warning: Patient {patient_id} has anomalies: {', '.join(anomalies)}"
            cursor.execute("""
                INSERT INTO alerts (patient_id, level, message, timestamp, resolved)
                VALUES (?, ?, ?, ?, 0)
            """, (patient_id, status, alert_msg, recorded_at))
            log_message += f" Alert triggered: {alert_msg}"

        db_conn.commit()

        return {
            "success": True,
            "vitals_id": vitals_id,
            "patient_id": patient_id,
            "status": status,
            "anomalies": anomalies,
            "log": log_message
        }

class DietPlanAgent(BaseAgent):
    def __init__(self):
        super().__init__("Diet Plan Agent", "Generates custom diet plans based on health conditions")

    def process(self, payload: dict, db_conn) -> dict:
        patient_id = payload.get("patient_id")
        condition = payload.get("condition", "").strip()
        veg_type = payload.get("veg_type", "veg").strip().lower()
        if veg_type not in ["veg", "non-veg"]:
            veg_type = "veg"

        if not patient_id:
            return {"success": False, "log": "Patient ID is required to generate a diet plan"}

        cursor = db_conn.cursor()
        
        # 1. Look up protocol information
        cursor.execute("SELECT diet_notes, treatment FROM disease_protocols WHERE name LIKE ?", (f"%{condition}%",))
        protocol = cursor.fetchone()
        
        diet_notes = protocol["diet_notes"] if protocol else "Low glycemic load, high protein, rich in vitamins and minerals."
        treatment_notes = protocol["treatment"] if protocol else "Routine lifestyle modifications."

        # 2. Heuristic generation of meal plans based on condition
        cond_lower = condition.lower()
        
        # Diet database for 10 conditions (Veg & Non-Veg)
        diets = {
            "pcod": {
                "veg": {
                    "macros": {"calories": 1600, "protein": "75g", "carbs": "120g (Low GI)", "fats": "50g"},
                    "breakfast": "Oats porridge with chia seeds and almond milk. Handful of walnuts.",
                    "mid_morning": "Green tea and roasted almonds.",
                    "lunch": "Quinoa salad with grilled tofu, spinach, cucumbers, and olive oil dressing.",
                    "evening": "Sprouted moong chat.",
                    "dinner": "Paneer stir-fry with broccoli, bell peppers, and asparagus. Small portion of brown rice.",
                    "rules": [
                        "Avoid refined sugar and white flour entirely.",
                        "Eat a protein-rich breakfast within 1 hour of waking.",
                        "Drink 3 liters of water daily.",
                        "Limit dairy products; prefer plant-based alternatives."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1600, "protein": "85g", "carbs": "110g (Low GI)", "fats": "50g"},
                    "breakfast": "2 scrambled egg whites with spinach and 1 slice of gluten-free toast. Unsweetened almond milk.",
                    "mid_morning": "Green tea and walnuts.",
                    "lunch": "Quinoa salad with grilled chicken breast, mixed leafy greens, and olive oil dressing.",
                    "evening": "Roasted chickpeas.",
                    "dinner": "Baked salmon with broccoli, bell peppers, and asparagus. Small portion of brown rice.",
                    "rules": [
                        "Avoid refined sugar and white flour entirely.",
                        "Eat a protein-rich breakfast within 1 hour of waking.",
                        "Drink 3-4 liters of water daily.",
                        "Limit red meat; prioritize lean poultry and fatty fish."
                    ]
                }
            },
            "pcos": {
                "veg": {
                    "macros": {"calories": 1600, "protein": "80g", "carbs": "120g", "fats": "50g"},
                    "breakfast": "Moong dal chilla (2) stuffed with grated paneer and spinach.",
                    "mid_morning": "Apple slices with almond butter.",
                    "lunch": "Brown rice with chickpea curry (chole) and side cucumber salad.",
                    "evening": "Roasted pumpkin seeds and green tea.",
                    "dinner": "Grilled tempeh and stir-fried cauliflower, carrots, and green beans.",
                    "rules": [
                        "Focus on low glycemic index foods to manage insulin resistance.",
                        "Maintain a high protein intake to increase satiety.",
                        "Incorporate daily resistance training.",
                        "Avoid processed foods and trans fats."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1600, "protein": "90g", "carbs": "110g", "fats": "50g"},
                    "breakfast": "Omelette (2 eggs) with spinach and mushrooms, cooked in olive oil.",
                    "mid_morning": "A bowl of mixed berries and walnuts.",
                    "lunch": "Brown rice with grilled chicken breast and sautéed green beans.",
                    "evening": "Roasted pumpkin seeds and green tea.",
                    "dinner": "Baked sea bass or cod with roasted cauliflower and a side salad.",
                    "rules": [
                        "Focus on low glycemic load and high lean protein.",
                        "Consume anti-inflammatory foods (omega-3 from fish).",
                        "Avoid endocrine disruptors like plastic containers.",
                        "Engage in 150 min of moderate exercise per week."
                    ]
                }
            },
            "hypothyroid": {
                "veg": {
                    "macros": {"calories": 1500, "protein": "70g", "carbs": "140g", "fats": "45g"},
                    "breakfast": "Gluten-free oatmeal with walnuts, pumpkin seeds, and cooked carrots. Unsweetened almond milk.",
                    "mid_morning": "A bowl of fresh papaya or apple.",
                    "lunch": "Brown rice with paneer curry and thoroughly cooked carrots (no raw cruciferous vegetables).",
                    "evening": "Roasted pumpkin seeds and herbal tea.",
                    "dinner": "Red lentil dal with cooked green beans and grilled tofu.",
                    "rules": [
                        "Take thyroid medication on an empty stomach at least 1 hour before breakfast.",
                        "Avoid raw cruciferous vegetables (cabbage, broccoli, kale); cook them thoroughly to deactivate goitrogens.",
                        "Ensure adequate iodine (iodized salt) and selenium intake.",
                        "Avoid calcium/iron supplements within 4 hours of thyroid meds."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1500, "protein": "80g", "carbs": "135g", "fats": "45g"},
                    "breakfast": "Scrambled eggs (2) with cooked spinach, and 2 Brazil nuts (for selenium).",
                    "mid_morning": "A bowl of papaya or orange slices.",
                    "lunch": "Brown rice with grilled mackerel or salmon and cooked carrots.",
                    "evening": "Roasted pumpkin seeds and herbal tea.",
                    "dinner": "Chicken breast vegetable stew with carrots and green beans.",
                    "rules": [
                        "Take thyroid medication on an empty stomach at least 1 hour before breakfast.",
                        "Cruciferous vegetables must be cooked thoroughly.",
                        "Incorporate selenium-rich foods like Brazil nuts and fish.",
                        "Avoid calcium or iron supplements within 4 hours of levothyroxine."
                    ]
                }
            },
            "hyperthyroid": {
                "veg": {
                    "macros": {"calories": 2200, "protein": "85g", "carbs": "250g", "fats": "70g"},
                    "breakfast": "Almond milk shake with peanut butter, banana, oats, and pea protein.",
                    "mid_morning": "Mixed berries and pumpkin seeds.",
                    "lunch": "Quinoa with black beans, avocado, and grilled tofu.",
                    "evening": "Hummus with cucumber and carrot sticks.",
                    "dinner": "Cottage cheese (paneer) steaks with sweet potato mash and sautéed zucchini.",
                    "rules": [
                        "Avoid iodine-rich foods like seaweed, kelp, iodized salt, and excessive dairy.",
                        "Increase calorie intake to counter hyper-metabolism and prevent weight loss.",
                        "Ensure calcium-rich foods are consumed to preserve bone density.",
                        "Limit caffeine and stimulants which worsen tremors and heart rate."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 2300, "protein": "95g", "carbs": "240g", "fats": "75g"},
                    "breakfast": "Peanut butter banana smoothie with whey protein, plus 2 boiled eggs on the side.",
                    "mid_morning": "Mixed berries and pumpkin seeds.",
                    "lunch": "Quinoa with black beans, avocado, and grilled chicken breast.",
                    "evening": "Hummus with cucumber and carrot sticks.",
                    "dinner": "Lean beef stir-fry or baked salmon with sweet potato mash and sautéed zucchini.",
                    "rules": [
                        "Avoid iodine-rich foods like kelp, seaweed, and iodized salt.",
                        "Prioritize high-calorie, high-protein meals.",
                        "Incorporate calcium and Vitamin D to protect bones.",
                        "Avoid caffeine and tobacco."
                    ]
                }
            },
            "breast": {
                "veg": {
                    "macros": {"calories": 1700, "protein": "75g", "carbs": "160g", "fats": "50g"},
                    "breakfast": "Flaxseed smoothie with soy milk, banana, and mixed berries.",
                    "mid_morning": "Walnuts and green tea.",
                    "lunch": "Spinach, chickpea, and cucumber salad with olive oil dressing.",
                    "evening": "Roasted edamame.",
                    "dinner": "Stir-fried tofu with bell peppers, broccoli, and a side of quinoa.",
                    "rules": [
                        "Limit caffeine strictly, as it can aggravate breast pain/mastalgia.",
                        "Incorporate ground flaxseeds daily for estrogen balance.",
                        "Maintain a healthy weight (BMI < 25) to lower breast health risks.",
                        "Limit alcohol intake entirely."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1750, "protein": "85g", "carbs": "150g", "fats": "55g"},
                    "breakfast": "Flaxseed smoothie with yogurt and mixed berries. 1 boiled egg.",
                    "mid_morning": "Walnuts and green tea.",
                    "lunch": "Grilled salmon over a bed of spinach and chickpea salad.",
                    "evening": "Roasted edamame.",
                    "dinner": "Garlic herb chicken breast with stir-fried bell peppers, broccoli, and quinoa.",
                    "rules": [
                        "Strictly avoid caffeine to reduce mastalgia.",
                        "Eat omega-3 rich fish like salmon for anti-inflammatory benefits.",
                        "Consume ground flaxseeds and cruciferous vegetables.",
                        "Perform monthly self-breast examinations."
                    ]
                }
            },
            "cervical": {
                "veg": {
                    "macros": {"calories": 1700, "protein": "75g", "carbs": "170g", "fats": "45g"},
                    "breakfast": "Papaya smoothie with chia seeds, spinach, and almond milk.",
                    "mid_morning": "Orange slices and pumpkin seeds.",
                    "lunch": "Yellow lentil dal with spinach, carrots, and brown rice (high folate).",
                    "evening": "Baby carrots with guacamole.",
                    "dinner": "Grilled tempeh with roasted broccoli and bell peppers.",
                    "rules": [
                        "Eat foods rich in folate, Vitamin C, and Vitamin E to support cervical health.",
                        "Maintain a strong immune system to clear HPV infections.",
                        "Ensure regular screening via Pap smear and HPV tests.",
                        "Avoid smoking, which depletes Vitamin C and impairs cervical immunity."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1700, "protein": "85g", "carbs": "160g", "fats": "50g"},
                    "breakfast": "Scrambled eggs (2) with bell peppers and spinach. Fresh papaya on the side.",
                    "mid_morning": "Orange slices and pumpkin seeds.",
                    "lunch": "Turkey breast roll-ups with a large spinach salad and orange vinaigrette.",
                    "evening": "Baby carrots with guacamole.",
                    "dinner": "Baked cod or salmon with roasted broccoli and bell peppers.",
                    "rules": [
                        "Prioritize high antioxidant and folate-rich foods.",
                        "Support immune defense against HPV with vitamins A, C, and E.",
                        "Avoid smoking completely.",
                        "Get the HPV vaccine (Gardasil 9) if eligible."
                    ]
                }
            },
            "endometriosis": {
                "veg": {
                    "macros": {"calories": 1700, "protein": "75g", "carbs": "160g", "fats": "55g (High Omega-3)"},
                    "breakfast": "Ginger turmeric berry smoothie with hemp seeds, spinach, and water.",
                    "mid_morning": "Pear slices with almond butter.",
                    "lunch": "Warm quinoa bowl with edamame, avocado, roasted sweet potatoes, and tahini.",
                    "evening": "Walnuts and green tea.",
                    "dinner": "Black bean soup with a large leafy green salad and olive oil dressing (gluten-free).",
                    "rules": [
                        "Prioritize anti-inflammatory foods (turmeric, ginger, walnuts).",
                        "Eliminate gluten, dairy, and refined sugar to reduce pain triggers.",
                        "Consume high-fiber foods to help bind and excrete excess estrogen.",
                        "Avoid red meat, alcohol, and trans fats entirely."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1700, "protein": "85g", "carbs": "150g", "fats": "55g (High Omega-3)"},
                    "breakfast": "Ginger turmeric berry smoothie with hemp seeds. 2 poached eggs.",
                    "mid_morning": "Pear slices with almond butter.",
                    "lunch": "Grilled salmon or trout with quinoa, roasted sweet potatoes, and edamame.",
                    "evening": "Walnuts and green tea.",
                    "dinner": "Baked chicken breast with a large leafy green salad and olive oil dressing.",
                    "rules": [
                        "Focus on high omega-3 fatty acids from fish to lower prostaglandins.",
                        "Avoid red meat completely, as it promotes inflammatory pathways.",
                        "Strictly limit gluten and dairy products.",
                        "Ensure fiber intake exceeds 30g daily."
                    ]
                }
            },
            "menstrual": {
                "veg": {
                    "macros": {"calories": 1800, "protein": "75g", "carbs": "180g", "fats": "50g"},
                    "breakfast": "Overnight oats with dark chocolate shavings, banana, pumpkin seeds, and almond milk (high magnesium).",
                    "mid_morning": "A bowl of sliced strawberries and a hot cup of chamomile tea.",
                    "lunch": "Chickpea and spinach stew with brown rice.",
                    "evening": "Roasted almonds.",
                    "dinner": "Grilled tofu and roasted asparagus with hot ginger tea.",
                    "rules": [
                        "Ensure high magnesium intake to relax uterine muscles and reduce cramping.",
                        "Include Vitamin B1 (thiamine) and B6 to regulate mood and uterine tone.",
                        "Avoid caffeine, alcohol, and carbonated beverages during periods.",
                        "Use heat therapy (heating pad) for acute dysmenorrhea."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1800, "protein": "85g", "carbs": "170g", "fats": "55g"},
                    "breakfast": "2 hard-boiled eggs with half an avocado on gluten-free toast. A square of dark chocolate.",
                    "mid_morning": "Strawberries and hot chamomile tea.",
                    "lunch": "Chicken breast and spinach stew with brown rice.",
                    "evening": "Roasted almonds.",
                    "dinner": "Grilled salmon and roasted asparagus with hot ginger tea.",
                    "rules": [
                        "Maximize magnesium and iron intake, especially during heavy flows.",
                        "Avoid cold beverages; sip warm teas (chamomile, ginger).",
                        "Limit high-sodium foods to prevent bloating.",
                        "Maintain a cycle tracker to identify symptoms."
                    ]
                }
            },
            "fibroids": {
                "veg": {
                    "macros": {"calories": 1700, "protein": "75g", "carbs": "165g", "fats": "45g"},
                    "breakfast": "Green smoothie (spinach, kale, apple, chia seeds) with fortified soy milk.",
                    "mid_morning": "A bowl of cherries or organic green grapes.",
                    "lunch": "Broccoli, carrot, and pinto bean salad with lemon-tahini dressing.",
                    "evening": "Roasted pumpkin seeds.",
                    "dinner": "Baked paneer or tofu with roasted asparagus and brown rice.",
                    "rules": [
                        "Prioritize cruciferous vegetables (broccoli, cabbage) which help metabolize estrogen.",
                        "High-fiber diet helps bind and eliminate estrogen, slowing fibroid growth.",
                        "Avoid red meat, ham, and high-fat dairy which stimulate fibroids.",
                        "Maintain optimal Vitamin D levels."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1700, "protein": "85g", "carbs": "155g", "fats": "50g"},
                    "breakfast": "Green smoothie (spinach, kale, apple, chia seeds) with 2 egg whites on the side.",
                    "mid_morning": "A bowl of cherries.",
                    "lunch": "Baked cod or mahi-mahi with steamed broccoli, carrots, and brown rice.",
                    "evening": "Roasted pumpkin seeds.",
                    "dinner": "Grilled turkey breast with roasted asparagus and a small portion of quinoa.",
                    "rules": [
                        "Strictly avoid red meat and ham (shown to increase fibroid risk).",
                        "Focus on high fiber and lean poultry/white fish.",
                        "Incorporate green tea, which contains EGCG to inhibit fibroid cell growth.",
                        "Monitor fibroid size with pelvic ultrasounds."
                    ]
                }
            },
            "osteoporosis": {
                "veg": {
                    "macros": {"calories": 1800, "protein": "80g", "carbs": "170g", "fats": "50g"},
                    "breakfast": "Greek yogurt or fortified soy yogurt topped with sesame seeds, almonds, and sliced strawberries.",
                    "mid_morning": "Fortified orange juice and dried figs (high calcium).",
                    "lunch": "Tofu and bok choy stir-fry with sesame seeds, and a side kale salad.",
                    "evening": "Roasted almonds.",
                    "dinner": "Lentil soup with cooked broccoli and brown rice.",
                    "rules": [
                        "Target at least 1200mg of Calcium and 1000-2000 IU of Vitamin D3 daily.",
                        "Avoid excessive salt and caffeine, which leach calcium from bones.",
                        "Incorporate daily weight-bearing exercises (walking, strength training).",
                        "Limit alcohol intake; avoid tobacco."
                    ]
                },
                "non-veg": {
                    "macros": {"calories": 1800, "protein": "90g", "carbs": "160g", "fats": "50g"},
                    "breakfast": "Greek yogurt with almonds, plus 2 boiled eggs on the side.",
                    "mid_morning": "Fortified orange juice and dried figs.",
                    "lunch": "Large spinach and kale salad topped with canned sardines (with bones - high calcium) and sesame dressing.",
                    "evening": "Roasted almonds.",
                    "dinner": "Baked salmon with cooked broccoli and brown rice.",
                    "rules": [
                        "Incorporate fish with edible bones (sardines, salmon) for natural calcium.",
                        "Ensure daily weight-bearing and resistance training.",
                        "Restrict sodium intake to less than 2000mg/day.",
                        "Follow up with regular bone mineral density (DXA) scans."
                    ]
                }
            }
        }

        # Match condition keywords to select the correct diet plan
        selected_diet = None
        matched_name = "General Health Diet"
        
        if "pcod" in cond_lower:
            selected_diet = diets["pcod"]
            matched_name = "PCOD (Polycystic Ovarian Disease)"
        elif "pcos" in cond_lower:
            selected_diet = diets["pcos"]
            matched_name = "PCOS (Polycystic Ovary Syndrome)"
        elif "hypothyroid" in cond_lower or ("thyroid" in cond_lower and "hypo" in cond_lower):
            selected_diet = diets["hypothyroid"]
            matched_name = "Hypothyroidism"
        elif "hyperthyroid" in cond_lower or ("thyroid" in cond_lower and "hyper" in cond_lower):
            selected_diet = diets["hyperthyroid"]
            matched_name = "Hyperthyroidism"
        elif "breast" in cond_lower or "fibroadenoma" in cond_lower:
            selected_diet = diets["breast"]
            matched_name = "Breast Health & Fibroadenoma"
        elif "cervical" in cond_lower or "hpv" in cond_lower:
            selected_diet = diets["cervical"]
            matched_name = "Cervical Health & HPV"
        elif "endometriosis" in cond_lower:
            selected_diet = diets["endometriosis"]
            matched_name = "Endometriosis"
        elif "menstrual" in cond_lower or "dysmenorrhea" in cond_lower or "amenorrhea" in cond_lower:
            selected_diet = diets["menstrual"]
            matched_name = "Menstrual Disorders"
        elif "fibroid" in cond_lower:
            selected_diet = diets["fibroids"]
            matched_name = "Uterine Fibroids"
        elif "osteoporosis" in cond_lower:
            selected_diet = diets["osteoporosis"]
            matched_name = "Osteoporosis (Women)"

        # Fallback to general health diet
        if not selected_diet:
            selected_diet = {
                "veg": {
                    "macros": {"calories": 1800, "protein": "75g", "carbs": "180g", "fats": "55g"},
                    "breakfast": "Oatmeal with sliced banana, chia seeds, and walnuts. Almond milk.",
                    "mid_morning": "Fresh apple or seasonal fruit.",
                    "lunch": "Whole grain wrap with grilled tofu, lettuce, tomato, and hummus.",
                    "evening": "A handful of mixed nuts.",
                    "dinner": "Lentil soup with steamed vegetables and brown rice.",
                    "rules": ["Follow a balanced diet.", "Drink plenty of water.", "Avoid processed sugars."]
                },
                "non-veg": {
                    "macros": {"calories": 1800, "protein": "85g", "carbs": "170g", "fats": "55g"},
                    "breakfast": "Oatmeal with banana, chia seeds, and 2 boiled eggs.",
                    "mid_morning": "Fresh apple.",
                    "lunch": "Whole grain wrap with grilled chicken breast, lettuce, tomato, and hummus.",
                    "evening": "A handful of mixed nuts.",
                    "dinner": "Baked salmon with steamed vegetables and brown rice.",
                    "rules": ["Follow a balanced diet.", "Drink plenty of water.", "Prioritize lean proteins."]
                }
            }

        # Select Veg or Non-Veg variation
        plan = selected_diet.get(veg_type)
        plan["veg_type"] = veg_type
        plan["diet_notes"] = diet_notes
        plan["medical_reference"] = treatment_notes

        # ── Treatment protocol per condition ──
        treatment_protocols = {
            "PCOD (Polycystic Ovarian Disease)": {
                "medications": ["Metformin (insulin sensitizer)", "Oral Contraceptive Pills (to regulate cycles)", "Spironolactone (anti-androgen for acne/hirsutism)"],
                "lifestyle": ["150 min/week moderate aerobic exercise", "Weight management (5-10% reduction improves symptoms)", "Stress management techniques (yoga, mindfulness)"],
                "supplements": ["Inositol (Myo-inositol + D-chiro-inositol 40:1)", "Vitamin D3 (2000 IU/day)", "Omega-3 fatty acids"],
                "monitoring": ["Regular blood glucose and HbA1c tests", "Hormone panel every 6 months (LH, FSH, Testosterone)", "Pelvic ultrasound annually"],
                "specialist": "Gynecologist / Reproductive Endocrinologist"
            },
            "PCOS (Polycystic Ovary Syndrome)": {
                "medications": ["Metformin 500-1500mg (insulin resistance)", "Combined OCP (Yasmin/Diane-35 for hormonal regulation)", "Letrozole/Clomiphene (if fertility desired)"],
                "lifestyle": ["Daily 30-45 min cardio + resistance training", "Anti-inflammatory diet adherence", "Sleep hygiene — 7-9 hours/night"],
                "supplements": ["Myo-inositol 4g/day", "Vitamin D3 (2000 IU/day)", "N-Acetyl Cysteine (NAC) 600mg"],
                "monitoring": ["Fasting insulin and glucose every 3 months", "AMH and testosterone levels every 6 months", "Annual pelvic ultrasound"],
                "specialist": "Gynecologist / Endocrinologist"
            },
            "Hypothyroidism": {
                "medications": ["Levothyroxine (Synthroid/Eltroxin) — dose titrated by TSH", "Liothyronine (T3) in select resistant cases"],
                "lifestyle": ["Take medication on empty stomach, 30-60 min before breakfast", "Regular moderate exercise (walking, swimming)", "Manage stress and ensure adequate sleep"],
                "supplements": ["Selenium 200mcg/day (Brazil nuts)", "Zinc 15mg/day", "Vitamin B12 if deficient"],
                "monitoring": ["TSH and Free T4 every 6-8 weeks (during dose adjustment)", "Annual thyroid function panel once stable", "Monitor for weight, energy, and hair changes"],
                "specialist": "Endocrinologist"
            },
            "Hyperthyroidism": {
                "medications": ["Methimazole (Tapazole) or Propylthiouracil (PTU)", "Beta-blockers (Propranolol) for heart rate/tremors", "Radioactive Iodine (RAI) therapy in refractory cases"],
                "lifestyle": ["Avoid iodine-rich foods (seaweed, kelp)", "Reduce caffeine and stimulants", "Gentle exercise — avoid strenuous activity until controlled"],
                "supplements": ["Calcium 1000mg + Vitamin D3 (bone protection)", "L-Carnitine 2g/day (may reduce hyperthyroid symptoms)", "Selenium 200mcg/day"],
                "monitoring": ["TSH, Free T3, Free T4 every 4-6 weeks during treatment", "Liver function tests (if on PTU)", "Annual bone density scan (DXA)"],
                "specialist": "Endocrinologist"
            },
            "Breast Health & Fibroadenoma": {
                "medications": ["NSAIDs for breast pain/mastalgia", "Evening Primrose Oil (EPO) for cyclic mastalgia", "Surgical excision if fibroadenoma > 3cm or growing"],
                "lifestyle": ["Wear a well-fitted supportive bra", "Reduce caffeine intake", "Maintain healthy BMI"],
                "supplements": ["Vitamin E 400 IU/day", "Evening Primrose Oil (GLA)", "Ground Flaxseed 2 tbsp/day"],
                "monitoring": ["Monthly breast self-examination", "Annual mammogram (age 40+) or ultrasound (age < 40)", "Follow-up ultrasound every 6 months for fibroadenoma"],
                "specialist": "Gynecologist / Breast Surgeon"
            },
            "Cervical Health & HPV": {
                "medications": ["HPV Vaccine (Gardasil 9) if eligible", "Topical treatments (Imiquimod, TCA) for genital warts", "LEEP/Cryotherapy for CIN 2+ lesions"],
                "lifestyle": ["Quit smoking — critical for HPV clearance", "Safe sexual practices", "Boost immune system through nutrition and sleep"],
                "supplements": ["Folate 800mcg/day", "Vitamin C 500mg/day", "Vitamin E and Selenium"],
                "monitoring": ["Pap smear every 3 years (age 21-65)", "HPV co-testing every 5 years (age 30+)", "Colposcopy if abnormal Pap results"],
                "specialist": "Gynecologist / Oncologist"
            },
            "Endometriosis": {
                "medications": ["NSAIDs (Ibuprofen/Naproxen) for pain management", "GnRH Agonists (Lupron) for advanced cases", "Hormonal IUD (Mirena) or Combined OCP for suppression"],
                "lifestyle": ["Anti-inflammatory diet (avoid gluten, dairy, red meat)", "Daily pelvic floor physiotherapy", "Heat therapy for acute pain episodes"],
                "supplements": ["Omega-3 Fish Oil 2g/day", "Curcumin (Turmeric) 1g/day", "Magnesium Glycinate 400mg/day"],
                "monitoring": ["Pelvic ultrasound every 6-12 months", "CA-125 levels (not diagnostic, but for tracking)", "Laparoscopy for definitive diagnosis/excision"],
                "specialist": "Gynecologist / Reproductive Surgeon"
            },
            "Menstrual Disorders": {
                "medications": ["Mefenamic Acid (Ponstan) for dysmenorrhea", "Tranexamic Acid for heavy menstrual bleeding", "Combined OCP or Progesterone for cycle regulation"],
                "lifestyle": ["Heat therapy (hot water bottle) for cramps", "Regular exercise to reduce PMS symptoms", "Adequate sleep and stress management"],
                "supplements": ["Magnesium Glycinate 400mg/day (muscle relaxant)", "Iron supplement if hemoglobin < 12 g/dL", "Vitamin B6 50mg/day for PMS"],
                "monitoring": ["Menstrual diary/cycle tracker", "Complete blood count (CBC) for anemia", "Pelvic ultrasound if heavy bleeding persists"],
                "specialist": "Gynecologist"
            },
            "Uterine Fibroids": {
                "medications": ["GnRH Agonists (Lupron) to shrink fibroids pre-surgery", "Ulipristal Acetate (Esmya) for symptom control", "Iron supplements for fibroid-related anemia"],
                "lifestyle": ["High-fiber, plant-based diet emphasis", "Maintain healthy weight (obesity increases estrogen)", "Avoid BPA and endocrine disruptors"],
                "supplements": ["Vitamin D3 2000-4000 IU/day (may inhibit fibroid growth)", "Green Tea Extract (EGCG) 800mg/day", "Iron supplement if anemic"],
                "monitoring": ["Pelvic ultrasound every 6-12 months to track size", "Hemoglobin and ferritin levels", "Consult for Uterine Fibroid Embolization (UFE) or Myomectomy if symptomatic"],
                "specialist": "Gynecologist / Interventional Radiologist"
            },
            "Osteoporosis (Women)": {
                "medications": ["Bisphosphonates (Alendronate/Risedronate) — first-line", "Denosumab (Prolia) injection every 6 months", "Calcitonin nasal spray (for acute vertebral fractures)"],
                "lifestyle": ["Weight-bearing exercise 30 min/day (walking, jogging, dancing)", "Resistance/strength training 2-3x/week", "Fall prevention strategies (balance exercises, home modifications)"],
                "supplements": ["Calcium 1200mg/day (from diet + supplement)", "Vitamin D3 2000 IU/day", "Vitamin K2 (MK-7) 100mcg/day"],
                "monitoring": ["Bone Mineral Density (DXA) scan every 2 years", "Serum calcium and Vitamin D levels annually", "FRAX score assessment for fracture risk"],
                "specialist": "Rheumatologist / Endocrinologist"
            },
        }
        plan["treatment"] = treatment_protocols.get(matched_name, {
            "medications": ["As prescribed by your healthcare provider"],
            "lifestyle": ["Regular physical activity", "Balanced nutrition", "Adequate sleep"],
            "supplements": ["Multivitamin as recommended"],
            "monitoring": ["Regular health check-ups"],
            "specialist": "Consult your primary care physician"
        })

        
        plan_json = json.dumps(plan)

        created_at = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO diet_plans (patient_id, condition, plan_json, created_at)
            VALUES (?, ?, ?, ?)
        """, (patient_id, f"{matched_name} ({veg_type.upper()})", plan_json, created_at))
        plan_id = cursor.lastrowid
        db_conn.commit()

        log_message = f"Generated customized {veg_type.upper()} diet plan for Patient ID {patient_id} for condition: {matched_name}."

        return {
            "success": True,
            "plan_id": plan_id,
            "patient_id": patient_id,
            "condition": f"{matched_name} ({veg_type.upper()})",
            "plan": plan,
            "log": log_message
        }


