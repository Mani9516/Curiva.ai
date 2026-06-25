"""Indian clinician display names for demo / seed data."""

INDIAN_FIRST = [
    "Priya", "Rajesh", "Anita", "Vikram", "Sunita", "Arjun", "Meera", "Kiran",
    "Deepa", "Sanjay", "Rohit", "Lakshmi", "Ananya", "Rajiv", "Aditya", "Neha",
    "Rahul", "Kartik", "Divya", "Suresh", "Pooja", "Amit", "Nisha", "Gaurav",
    "Kavita", "Harish", "Swati", "Manoj", "Ritu", "Varun", "Sneha", "Pranav",
    "Shreya", "Ashok", "Leela", "Siddharth", "Tanvi", "Ramesh", "Padma", "Ishaan",
]

INDIAN_LAST = [
    "Menon", "Sharma", "Iyer", "Patel", "Reddy", "Nair", "Kapoor", "Singh",
    "Das", "Joshi", "Banerjee", "Venkatesh", "Gupta", "Malhotra", "Chatterjee",
    "Pillai", "Kulkarni", "Desai", "Rao", "Mehta", "Agarwal", "Bose", "Krishnan",
    "Mishra", "Hegde", "Chopra", "Saxena", "Bhatt", "Ghosh", "Shetty",
]

DEFAULT_DOCTOR_DISPLAY_NAME = "Dr. Vikram Menon"

RADIOLOGIST_ULTRASOUND = "Dr. Kavita Hegde — Ultrasound"
RADIOLOGIST_XRAY = "Dr. Ramesh Pillai — Plain radiography"
RADIOLOGIST_MRI = "Dr. Suresh Kulkarni — MRI"
RADIOLOGIST_CT = "Dr. Amit Desai — CT"
RADIOLOGIST_GENERAL = "Dr. Padma Rao — General radiology"

RADIOLOGISTS_BY_SCAN_KEY = {
    "MRI": "Dr. Suresh Kulkarni (Neuro-Radiology)",
    "CT": "Dr. Amit Desai (Abdominal Imaging)",
    "X-Ray": "Dr. Ramesh Pillai (General Radiology)",
}

RADIOLOGIST_FALLBACK = "Dr. Kavita Hegde"

_LEGACY_EXACT_REPLACEMENTS = [
    ("Dr. Patel — CT", "Dr. Amit Desai — CT"),
    ("Dr. Singh — General radiology", "Dr. Padma Rao — General radiology"),
]

_LEGACY_PREFIX_REPLACEMENTS = [
    ("Dr. Watson", "Dr. Kavita Hegde"),
    ("Dr. Grey", "Dr. Amit Desai"),
    ("Dr. House", "Dr. Ramesh Pillai"),
    ("Dr. Franklin", "Dr. Padma Rao"),
    ("Dr. Kim", "Dr. Ramesh Pillai"),
    ("Dr. Alves", "Dr. Suresh Kulkarni"),
]


def radiologist_for_study(scan_type: str) -> str:
    s = (scan_type or "").lower()
    if "ultrasound" in s:
        return RADIOLOGIST_ULTRASOUND
    if "x-ray" in s or "xray" in s or "radiograph" in s:
        return RADIOLOGIST_XRAY
    if "mri" in s:
        return RADIOLOGIST_MRI
    if " ct" in f" {s}" or s.startswith("ct"):
        return RADIOLOGIST_CT
    return RADIOLOGIST_GENERAL


def migrate_legacy_doctor_names(cursor) -> None:
    """Replace Western demo radiologist names and corrupt care-team labels."""
    cursor.execute(
        """
        UPDATE users SET full_name = ?
        WHERE role = 'doctor'
          AND full_name IN ('Dr. Demo Physician', 'Dr. Aditya Kapoor')
        """,
        (DEFAULT_DOCTOR_DISPLAY_NAME,),
    )
    cursor.execute(
        """
        UPDATE users SET full_name = ?
        WHERE LOWER(TRIM(username)) = 'doctor1'
          AND full_name = 'Dr. Demo Physician'
        """,
        (DEFAULT_DOCTOR_DISPLAY_NAME,),
    )

    for old, new in _LEGACY_EXACT_REPLACEMENTS:
        cursor.execute(
            "UPDATE imaging_scans SET assigned_radiologist = ? WHERE assigned_radiologist = ?",
            (new, old),
        )
        cursor.execute(
            "UPDATE appointments SET care_team = ? WHERE care_team = ?",
            (new, old),
        )

    for old, new in _LEGACY_PREFIX_REPLACEMENTS:
        cursor.execute(
            """
            UPDATE imaging_scans
            SET assigned_radiologist = REPLACE(assigned_radiologist, ?, ?)
            WHERE assigned_radiologist LIKE ?
            """,
            (old, new, f"{old}%"),
        )
        cursor.execute(
            """
            UPDATE appointments
            SET care_team = REPLACE(care_team, ?, ?)
            WHERE care_team LIKE ?
            """,
            (old, new, f"{old}%"),
        )

    cursor.execute(
        """
        UPDATE appointments SET care_team = ?
        WHERE care_team IS NULL
           OR TRIM(care_team) = ''
           OR LOWER(TRIM(care_team)) LIKE '%undefined%'
        """,
        (DEFAULT_DOCTOR_DISPLAY_NAME,),
    )

    cursor.execute(
        """
        UPDATE users SET full_name = ?
        WHERE role = 'doctor'
          AND (
            full_name IS NULL
            OR TRIM(full_name) = ''
            OR LOWER(TRIM(full_name)) = 'undefined'
            OR LOWER(TRIM(full_name)) LIKE '%undefined%'
          )
        """,
        (DEFAULT_DOCTOR_DISPLAY_NAME,),
    )

    cursor.execute(
        """
        UPDATE appointments SET care_team = REPLACE(care_team, 'MediFlow', 'Curiva')
        WHERE care_team LIKE '%MediFlow%'
        """
    )
    cursor.execute(
        """
        UPDATE appointments SET location = REPLACE(location, 'MediFlow', 'Curiva')
        WHERE location LIKE '%MediFlow%'
        """
    )
