import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.firebase import get_firestore_client

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db():
    db = get_firestore_client()
    if hasattr(db, "clear"):
        db.clear()
    from backend.app.services.seed_service import seed_database
    seed_database(force=True)


def test_list_resources():
    """Anyone can list resources."""
    resp = client.get("/api/resources")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 6
    names = [r["name"] for r in data]
    assert "Electronics Lab Kit" in names
    assert "Rover Robotics Set" in names


def test_search_and_filter_resources():
    """Filter by category, search by term."""
    # Search
    resp = client.get("/api/resources?search=Camera")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert "Sony FX3 Camera Kit" in [r["name"] for r in data]

    # Category filter
    resp = client.get("/api/resources?category=Robotics")
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["category"] == "Robotics" or r["type"] == "Robotics" for r in data)


def test_student_cannot_create_resource():
    """Students are read-only and cannot create resources."""
    headers = {"Authorization": "Bearer demo-student-token"}
    resp = client.post("/api/resources", headers=headers, json={
        "name": "Unauthorized Oscilloscope",
        "category": "Electronics",
        "location": "Room 101",
        "description": "Student attempting to add resource"
    })
    assert resp.status_code == 403
    assert "Requires Faculty or Admin privileges" in resp.json()["detail"]


def test_faculty_create_and_manage_own_resource():
    """Faculty can create, edit, and delete only their own resource."""
    faculty_headers = {"Authorization": "Bearer demo-faculty-token"}

    # Create resource
    resp = client.post("/api/resources", headers=faculty_headers, json={
        "name": "Digital Multimeter Fluke 87V",
        "category": "Equipment",
        "type": "Equipment",
        "location": "North Science · Lab 102",
        "description": "True-RMS industrial multimeter with probe set.",
        "status": "Available today",
        "condition": "Good",
        "quantity": 2
    })
    assert resp.status_code == 201
    created = resp.json()
    res_id = created["id"]
    assert created["owner_uid"] == "faculty-reynolds-002"

    # Edit resource
    resp = client.patch(f"/api/resources/{res_id}", headers=faculty_headers, json={
        "status": "In Use"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "In Use"

    # Delete resource
    resp = client.delete(f"/api/resources/{res_id}", headers=faculty_headers)
    assert resp.status_code == 200


def test_faculty_cannot_edit_other_faculty_resource():
    """Faculty cannot edit or delete resources owned by someone else."""
    # Create another faculty token: faculty-other-999
    other_faculty_headers = {"Authorization": "Bearer test-token:faculty-other-999:other@pcu.edu.in:faculty:true"}

    # res-electronics-001 is owned by faculty-reynolds-002
    resp = client.patch("/api/resources/res-electronics-001", headers=other_faculty_headers, json={
        "name": "Hijacked Name"
    })
    assert resp.status_code == 403
    assert "Faculty can modify only their own resources" in resp.json()["detail"]

    resp = client.delete("/api/resources/res-electronics-001", headers=other_faculty_headers)
    assert resp.status_code == 403


def test_admin_can_manage_all_resources():
    """Admin has universal permission to edit and delete any resource."""
    admin_headers = {"Authorization": "Bearer demo-admin-token"}

    # Admin updates resource owned by Reynolds
    resp = client.patch("/api/resources/res-electronics-001", headers=admin_headers, json={
        "location": "Central Storage Vault"
    })
    assert resp.status_code == 200
    assert resp.json()["location"] == "Central Storage Vault"

    # Admin can delete any resource
    resp = client.delete("/api/resources/res-printer-006", headers=admin_headers)
    assert resp.status_code == 200
