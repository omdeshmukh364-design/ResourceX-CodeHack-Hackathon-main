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


def test_create_booking_valid():
    """Verified student can create a booking request."""
    student_headers = {"Authorization": "Bearer demo-student-token"}
    resp = client.post("/api/bookings", headers=student_headers, json={
        "resource_id": "res-robotics-002",
        "start_time": "2026-11-05T10:00:00Z",
        "end_time": "2026-11-05T12:00:00Z",
        "purpose": "Autonomous obstacle avoidance testing"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["requester_uid"] == "student-jamie-001"
    assert data["resource_id"] == "res-robotics-002"


def test_create_booking_invalid_time_range():
    """Start time after end time is rejected."""
    student_headers = {"Authorization": "Bearer demo-student-token"}
    resp = client.post("/api/bookings", headers=student_headers, json={
        "resource_id": "res-robotics-002",
        "start_time": "2026-11-05T14:00:00Z",
        "end_time": "2026-11-05T10:00:00Z",
        "purpose": "Testing reverse time"
    })
    assert resp.status_code == 400
    assert "start time must be strictly before end time" in resp.json()["detail"].lower()


def test_approve_and_prevent_overlapping_double_booking():
    """Approval of an overlapping booking for the same resource is rejected with 409 Conflict."""
    student_headers = {"Authorization": "Bearer demo-student-token"}
    faculty_headers = {"Authorization": "Bearer demo-faculty-token"}

    # Request A: 10:00 - 12:00
    resp_a = client.post("/api/bookings", headers=student_headers, json={
        "resource_id": "res-camera-003",
        "start_time": "2026-11-10T10:00:00Z",
        "end_time": "2026-11-10T12:00:00Z",
        "purpose": "Documentary Film Project"
    })
    assert resp_a.status_code == 201
    id_a = resp_a.json()["id"]

    # Approve Request A
    resp_app_a = client.post(f"/api/bookings/{id_a}/approve", headers=faculty_headers, json={
        "notes": "Approved for film production."
    })
    assert resp_app_a.status_code == 200
    assert resp_app_a.json()["status"] == "approved"

    # Request B overlaps: 11:00 - 13:00
    resp_b = client.post("/api/bookings", headers=student_headers, json={
        "resource_id": "res-camera-003",
        "start_time": "2026-11-10T11:00:00Z",
        "end_time": "2026-11-10T13:00:00Z",
        "purpose": "Overlapping request attempt"
    })
    assert resp_b.status_code == 201
    id_b = resp_b.json()["id"]

    # Approving Request B must fail with 409 Conflict!
    resp_app_b = client.post(f"/api/bookings/{id_b}/approve", headers=faculty_headers, json={
        "notes": "Trying to approve conflict"
    })
    assert resp_app_b.status_code == 409
    assert "Conflict" in resp_app_b.json()["detail"]


def test_faculty_permissions_on_bookings():
    """Faculty can approve/reject ONLY bookings for resources they own."""
    # Another faculty user
    other_faculty = {"Authorization": "Bearer test-token:fac-99:fac@pcu.edu.in:faculty:true"}

    # book-demo-002 is for Project Room 3B owned by Dr. Reynolds (faculty-reynolds-002)
    resp = client.post("/api/bookings/book-demo-002/approve", headers=other_faculty)
    assert resp.status_code == 403
    assert "Only the resource owner or an administrator can approve" in resp.json()["detail"]


def test_booking_rejection():
    """Owner can reject a pending booking."""
    faculty_headers = {"Authorization": "Bearer demo-faculty-token"}
    resp = client.post("/api/bookings/book-demo-002/reject", headers=faculty_headers, json={
        "reason": "Room reserved for department meeting."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["rejection_reason"] == "Room reserved for department meeting."


def test_booking_cancellation():
    """Requester student can cancel their own booking."""
    student_headers = {"Authorization": "Bearer demo-student-token"}
    resp = client.post("/api/bookings/book-demo-002/cancel", headers=student_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_checkout_and_return_flow_with_damage():
    """Full lifecycle: approved -> checked_out -> returned with damage recording."""
    faculty_headers = {"Authorization": "Bearer demo-faculty-token"}

    # book-demo-001 is already approved in seed data
    # Checkout
    resp_co = client.post("/api/bookings/book-demo-001/checkout", headers=faculty_headers)
    assert resp_co.status_code == 200
    assert resp_co.json()["status"] == "checked_out"

    # Return with damage
    resp_ret = client.post("/api/bookings/book-demo-001/return", headers=faculty_headers, json={
        "condition": "Damaged",
        "damage_notes": "Multimeter test probe leads snapped at base."
    })
    assert resp_ret.status_code == 200
    ret_data = resp_ret.json()
    assert ret_data["return_condition"] == "Damaged"
    assert ret_data["damage_notes"] == "Multimeter test probe leads snapped at base."

    # Verify resource status updated to Maintenance Required
    res_resp = client.get("/api/resources/res-electronics-001")
    assert res_resp.status_code == 200
    res_data = res_resp.json()
    assert res_data["condition"] == "Damaged"
    assert res_data["status"] == "Maintenance Required"

    # Verify return record is in /api/returns
    ret_list = client.get("/api/returns", headers=faculty_headers)
    assert ret_list.status_code == 200
    assert len(ret_list.json()) >= 1

    # Attempting duplicate checkout or return on already returned booking fails
    resp_dup = client.post("/api/bookings/book-demo-001/return", headers=faculty_headers, json={
        "condition": "Good"
    })
    assert resp_dup.status_code == 400
    assert "Cannot return booking with status 'returned'" in resp_dup.json()["detail"]
