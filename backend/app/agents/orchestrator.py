from app.agents.base import (
    PatientIntakeAgent,
    ClinicalSummaryAgent,
    ImagingWorkflowAgent,
    EHRAgent,
    AlertAgent,
    TaskPlannerAgent,
    AnalyticsAgent
)
from app.db import get_db_conn
import traceback

class WorkflowOrchestrator:
    def __init__(self):
        self.agents = {
            "Patient Intake Agent": PatientIntakeAgent(),
            "Clinical Summary Agent": ClinicalSummaryAgent(),
            "Imaging Workflow Agent": ImagingWorkflowAgent(),
            "EHR Agent": EHRAgent(),
            "Alert Agent": AlertAgent(),
            "Task Planner Agent": TaskPlannerAgent(),
            "Analytics Agent": AnalyticsAgent()
        }

    def run_intake_pipeline(self, name: str, age: int, gender: str, symptoms: str, notes: str = "") -> dict:
        conn = get_db_conn()
        steps = []
        patient_id = None
        current_agent_name = "Patient Intake Agent"
        payload = {
            "name": name,
            "age": age,
            "gender": gender,
            "symptoms": symptoms,
            "notes": notes
        }
        
        max_iterations = 10
        iteration = 0
        
        try:
            while current_agent_name and iteration < max_iterations:
                iteration += 1
                agent = self.agents.get(current_agent_name)
                if not agent:
                    steps.append({
                        "agent": current_agent_name,
                        "log": f"Agent {current_agent_name} not found in orchestrator.",
                        "success": False
                    })
                    break
                
                # Process step
                result = agent.process(payload, conn)
                steps.append({
                    "agent": agent.name,
                    "role": agent.role,
                    "log": result.get("log", ""),
                    "success": result.get("success", False)
                })
                
                if not result.get("success", False):
                    break
                
                # Carry forward IDs and key states
                if "patient_id" in result:
                    patient_id = result["patient_id"]
                    payload["patient_id"] = patient_id
                if "severity" in result:
                    payload["severity"] = result["severity"]
                if "needs_imaging" in result:
                    payload["needs_imaging"] = result["needs_imaging"]
                if "scan_type" in result:
                    payload["scan_type"] = result["scan_type"]
                if "hl7" in result:
                    payload["hl7"] = result["hl7"]
                if "fhir" in result:
                    payload["fhir"] = result["fhir"]
                
                # Determine next agent
                current_agent_name = result.get("next_agent")
                
            conn.commit()
            return {
                "success": True,
                "patient_id": patient_id,
                "steps": steps
            }
        except Exception as e:
            conn.rollback()
            error_trace = traceback.format_exc()
            steps.append({
                "agent": "System Orchestrator",
                "log": f"Pipeline failed with error: {str(e)}\n{error_trace}",
                "success": False
            })
            return {
                "success": False,
                "patient_id": patient_id,
                "steps": steps
            }
        finally:
            conn.close()

if __name__ == "__main__":
    # Small test
    orchestrator = WorkflowOrchestrator()
    res = orchestrator.run_intake_pipeline(
        name="John Doe",
        age=45,
        gender="Male",
        symptoms="High fever, cough, chest pain",
        notes="Patient reports chest pain since yesterday and severe coughing."
    )
    print("Pipeline result success:", res["success"])
    for step in res["steps"]:
        print(f"[{step['agent']}]: {step['log']}")
