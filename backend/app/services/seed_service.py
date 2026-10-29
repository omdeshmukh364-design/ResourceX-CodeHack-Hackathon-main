from datetime import datetime, timezone
from backend.app.firebase import get_firestore_client
from backend.app.models.user import UserRole, UserStatus

SAMPLE_USERS = [
    {
        "uid": "admin-main-003",
        "email": "admin@pcu.edu.in",
        "name": "Admin User",
        "role": UserRole.ADMIN.value,
        "status": UserStatus.ACTIVE.value,
        "department": "IT Administration",
        "email_verified": True,
    },
    {
        "uid": "faculty-reynolds-002",
        "email": "reynolds@pcu.edu.in",
        "name": "Dr. Robert Reynolds",
        "role": UserRole.FACULTY.value,
        "status": UserStatus.ACTIVE.value,
        "department": "Electrical & Computer Engineering",
        "email_verified": True,
    },
    {
        "uid": "student-jamie-001",
        "email": "jamie@pcu.edu.in",
        "name": "Jamie Smith",
        "role": UserRole.STUDENT.value,
        "status": UserStatus.ACTIVE.value,
        "department": "Computer Science & Engineering",
        "email_verified": True,
    },
    {
        "uid": "student-om-004",
        "email": "om.deshmukh24@pcu.edu.in",
        "name": "Om Deshmukh",
        "role": UserRole.STUDENT.value,
        "status": UserStatus.ACTIVE.value,
        "department": "Computer Science & Engineering",
        "email_verified": True,
    }
]

SAMPLE_RESOURCES = [
    {
        "id": "res-electronics-001",
        "name": "Electronics Lab Kit",
        "category": "Electronics",
        "type": "Equipment",
        "location": "North Science · Lab 204",
        "description": "Complete kit with multimeters, breadboards, oscilloscopes, and regulated power supplies.",
        "image": "/resourcex-lab.png",
        "status": "Available today",
        "condition": "Good",
        "quantity": 1,
        "available_quantity": 1,
        "owner_uid": "faculty-reynolds-002",
        "owner_name": "Dr. Robert Reynolds",
    },
    {
        "id": "res-robotics-002",
        "name": "Rover Robotics Set",
        "category": "Robotics",
        "type": "Equipment",
        "location": "Innovation Hub · Room 12",
        "description": "Autonomous rover with ultrasonic distance sensors, wheel encoders, and Arduino Mega microcontrollers.",
        "image": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=85",
        "status": "2 of 4 available",
        "condition": "Good",
        "quantity": 4,
        "available_quantity": 2,
        "owner_uid": "faculty-reynolds-002",
        "owner_name": "Dr. Robert Reynolds",
    },
    {
        "id": "res-camera-003",
        "name": "Sony FX3 Camera Kit",
        "category": "Media",
        "type": "Equipment",
        "location": "Arts Building · Media Desk",
        "description": "Full-frame cinema camera kit with 24-70mm GM lens, XLR audio handle, 2x 128GB CFexpress cards, and tripod.",
        "image": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85",
        "status": "Available tomorrow",
        "condition": "Good",
        "quantity": 1,
        "available_quantity": 1,
        "owner_uid": "faculty-reynolds-002",
        "owner_name": "Dr. Robert Reynolds",
    },
    {
        "id": "res-comptlab-004",
        "name": "Computing Lab · 32 seats",
        "category": "Labs",
        "type": "Space",
        "location": "West Campus · Floor 3",
        "description": "High-performance GPU cluster workstation lab with dual 4K monitors, ideal for machine learning and rendering.",
        "image": "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85",
        "status": "Available this week",
        "condition": "Good",
        "quantity": 32,
        "available_quantity": 32,
        "owner_uid": "faculty-reynolds-002",
        "owner_name": "Dr. Robert Reynolds",
    },
    {
        "id": "res-projroom-005",
        "name": "Project Room 3B",
        "category": "Spaces",
        "type": "Space",
        "location": "Main Library · Level 3",
        "description": "Sound-isolated collaborative project room with 65-inch digital whiteboard, conference phone, and seating for 8.",
        "image": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85",
        "status": "Available today",
        "condition": "Good",
        "quantity": 1,
        "available_quantity": 1,
        "owner_uid": "faculty-reynolds-002",
        "owner_name": "Dr. Robert Reynolds",
    },
    {
        "id": "res-printer-006",
        "name": "Formlabs 3L Printer",
        "category": "Prototyping",
        "type": "Equipment",
        "location": "Maker Space · Bay 2",
        "description": "Large-format stereolithography (SLA) 3D printer for precision prototyping with clear and tough resins.",
        "image": "https://images.unsplash.com/photo-1612831812770-9c9f7b2d4df0?auto=format&fit=crop&w=900&q=85",
        "status": "Available Friday",
        "condition": "Good",
        "quantity": 1,
        "available_quantity": 1,
        "owner_uid": "faculty-reynolds-002",
        "owner_name": "Dr. Robert Reynolds",
    }
]


def seed_database(force: bool = False):
    """Seed initial sample users and resources for development and testing."""
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Seed users
    for user_data in SAMPLE_USERS:
        doc_ref = db.collection("users").document(user_data["uid"])
        if force or not doc_ref.get().exists:
            u = dict(user_data)
            u["created_at"] = now_iso
            u["updated_at"] = now_iso
            doc_ref.set(u)

    # Seed resources
    for res_data in SAMPLE_RESOURCES:
        doc_ref = db.collection("resources").document(res_data["id"])
        if force or not doc_ref.get().exists:
            r = dict(res_data)
            r["created_at"] = now_iso
            r["updated_at"] = now_iso
            doc_ref.set(r)

    # Seed demo bookings
    demo_bookings = [
        {
            "id": "book-demo-001",
            "resource_id": "res-electronics-001",
            "resource_name": "Electronics Lab Kit",
            "resource_image": "/resourcex-lab.png",
            "resource_location": "North Science · Lab 204",
            "requester_uid": "student-jamie-001",
            "requester_name": "Jamie Smith",
            "requester_email": "jamie@pcu.edu.in",
            "owner_uid": "faculty-reynolds-002",
            "start_time": "2026-10-30T14:00:00Z",
            "end_time": "2026-10-30T16:00:00Z",
            "purpose": "Circuit analysis and oscilloscope probing for Capstone Project.",
            "status": "approved",
            "approved_by": "faculty-reynolds-002",
            "approved_at": now_iso,
            "created_at": now_iso,
            "updated_at": now_iso
        },
        {
            "id": "book-demo-002",
            "resource_id": "res-projroom-005",
            "resource_name": "Project Room 3B",
            "resource_image": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85",
            "resource_location": "Main Library · Level 3",
            "requester_uid": "student-jamie-001",
            "requester_name": "Jamie Smith",
            "requester_email": "jamie@pcu.edu.in",
            "owner_uid": "faculty-reynolds-002",
            "start_time": "2026-10-31T10:00:00Z",
            "end_time": "2026-10-31T11:30:00Z",
            "purpose": "Team sprint review and slide preparation.",
            "status": "pending",
            "created_at": now_iso,
            "updated_at": now_iso
        }
    ]

    for b in demo_bookings:
        doc_ref = db.collection("bookings").document(b["id"])
        if force or not doc_ref.get().exists:
            doc_ref.set(b)

    return {"message": "Seed completed successfully.", "users": len(SAMPLE_USERS), "resources": len(SAMPLE_RESOURCES)}
