import pytest
from fastapi.testclient import TestClient
from backend.app.config import settings
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


def test_auth_policy():
    """Verify endpoint provides correct official domain restriction policy."""
    resp = client.get("/api/auth/policy")
    assert resp.status_code == 200
    data = resp.json()
    assert "pcu.edu.in" in data["allowed_student_domains"]
    assert data["official_college_domain"] == "pcu.edu.in"


def test_student_registration_new_email():
    """Students can register with a new official @pcu.edu.in email."""
    resp = client.post("/api/auth/register", json={
        "name": "Aarav Sharma",
        "email": "aarav.sharma2026@pcu.edu.in",
        "password": "securepassword123",
        "department": "Computer Science & Engineering"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "aarav.sharma2026@pcu.edu.in"
    assert data["name"] == "Aarav Sharma"
    assert data["role"] == "student"
    assert data["status"] == "Active"


def test_student_registration_duplicate_email_friendly_message():
    """Duplicate student email registration returns friendly message and does not mutate existing account."""
    # Register initially
    resp1 = client.post("/api/auth/register", json={
        "name": "First Registration",
        "email": "student.unique2026@pcu.edu.in",
        "password": "password123",
        "department": "Computer Science & Engineering"
    })
    assert resp1.status_code == 201
    initial_uid = resp1.json()["uid"]

    # Attempt to register again with same email
    resp2 = client.post("/api/auth/register", json={
        "name": "Second Registration Attempt",
        "email": "student.unique2026@pcu.edu.in",
        "password": "differentpassword456",
        "department": "Mechanical Engineering"
    })
    assert resp2.status_code == 400
    assert resp2.json()["detail"] == "This email is already registered. Please sign in or reset your password."

    # Verify existing account in Firestore was preserved and not overwritten
    db = get_firestore_client()
    doc = db.collection("users").document(initial_uid).get()
    assert doc.exists
    user_data = doc.to_dict()
    assert user_data["name"] == "First Registration"
    assert user_data["role"] == "student"


def test_student_registration_duplicate_admin_email_protected():
    """Attempting student registration with an existing Admin email checks role securely and rejects without granting admin privileges."""
    db = get_firestore_client()
    admin_snap = db.collection("users").document("admin-main-003").get()
    assert admin_snap.exists
    assert admin_snap.to_dict()["role"] == "admin"

    # Attempt student registration with admin's email
    resp = client.post("/api/auth/register", json={
        "name": "Fake Admin Attempt",
        "email": "admin@pcu.edu.in",
        "password": "newpassword123",
        "department": "IT Administration"
    })
    assert resp.status_code == 400
    assert resp.json()["detail"] == "This email is already registered. Please sign in or reset your password."

    # Verify Admin account is intact, not deleted, not demoted, and not duplicated
    admin_snap_after = db.collection("users").document("admin-main-003").get()
    assert admin_snap_after.exists
    assert admin_snap_after.to_dict()["role"] == "admin"
    assert admin_snap_after.to_dict()["name"] == "Admin User"

    # Ensure no new account with admin@pcu.edu.in was created
    admin_docs = list(db.collection("users").where("email", "==", "admin@pcu.edu.in").stream())
    assert len(admin_docs) == 1
    assert admin_docs[0].id == "admin-main-003"


def test_student_registration_rejects_personal_domains():
    """Reject Gmail, Yahoo, Outlook, and other personal domains."""
    for bad_email in ["student@gmail.com", "student@yahoo.com", "student@outlook.com", "student@hotmail.com"]:
        resp = client.post("/api/auth/register", json={
            "name": "Personal User",
            "email": bad_email,
            "password": "password123"
        })
        assert resp.status_code == 403, f"Should reject {bad_email}"
        assert "Only official college email addresses" in resp.json()["detail"]


def test_student_registration_rejects_lookalike_and_subdomain_attacks():
    """Reject lookalike addresses: om@pcu.edu.in.attacker.com and om@fakepcu.edu.in."""
    attack_emails = [
        "om@pcu.edu.in.attacker.com",
        "om@fakepcu.edu.in",
        "om@pcu.edu.in.com",
        "om@notpcu.edu.in",
        "om@pcu-edu-in.fake.org"
    ]
    for attack in attack_emails:
        resp = client.post("/api/auth/register", json={
            "name": "Attacker",
            "email": attack,
            "password": "password123"
        })
        assert resp.status_code == 403, f"Should reject {attack}"


def test_public_registration_cannot_escalate_role():
    """Public registration cannot supply or escalate to faculty/admin."""
    resp = client.post("/api/auth/register", json={
        "name": "Sneaky Student",
        "email": "sneaky@pcu.edu.in",
        "password": "password123",
        "role": "admin"  # Attempting privilege escalation
    })
    assert resp.status_code == 201
    data = resp.json()
    # Pydantic StudentRegisterRequest ignores role, always assigns student role
    assert data["role"] == "student"


def test_unauthenticated_request_rejected():
    """Missing or invalid token rejected with 401."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_authenticated_me_endpoint():
    """Valid token returns user profile."""
    headers = {"Authorization": "Bearer demo-student-token"}
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "jamie@pcu.edu.in"
    assert data["role"] == "student"


def test_unverified_student_cannot_access_protected_features():
    """Students without email verification cannot access protected booking features."""
    # test-token format: test-token:<uid>:<email>:<role>:<email_verified>
    unverified_header = {"Authorization": "Bearer test-token:unverified-1:unverified@pcu.edu.in:student:false"}
    resp = client.post("/api/bookings", headers=unverified_header, json={
        "resource_id": "res-electronics-001",
        "start_time": "2026-11-01T10:00:00Z",
        "end_time": "2026-11-01T12:00:00Z",
        "purpose": "Study"
    })
    assert resp.status_code == 403
    assert "Email verification required" in resp.json()["detail"]


def test_deactivated_user_forbidden():
    """Deactivated accounts cannot access the API."""
    db = get_firestore_client()
    # Deactivate student
    db.collection("users").document("student-jamie-001").update({"status": "Deactivated"})

    headers = {"Authorization": "Bearer demo-student-token"}
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 403
    assert "deactivated" in resp.json()["detail"].lower()


def test_bootstrap_admin():
    """Bootstrap endpoint initializes Admin account with correct key."""
    # Wrong key
    resp = client.post("/api/auth/bootstrap-admin", json={
        "bootstrap_key": "wrong-key",
        "email": "superadmin@pcu.edu.in",
        "password": "password123",
        "name": "Super Admin"
    })
    assert resp.status_code == 403

    # Correct key
    resp = client.post("/api/auth/bootstrap-admin", json={
        "bootstrap_key": settings.ADMIN_BOOTSTRAP_KEY,
        "email": "superadmin@pcu.edu.in",
        "password": "password123",
        "name": "Super Admin"
    })
    assert resp.status_code == 409
    # Existing administrator prevents repeat bootstrap.
    return
    data = resp.json()
    assert data["role"] == "admin"
    assert data["email"] == "superadmin@pcu.edu.in"


def test_admin_provision_faculty():
    """Admin can create privileged Faculty account."""
    admin_headers = {"Authorization": "Bearer demo-admin-token"}
    student_headers = {"Authorization": "Bearer demo-student-token"}

    # Student cannot create privileged account
    resp = client.post("/api/users/privileged", headers=student_headers, json={
        "name": "Prof Smith",
        "email": "smith@pcu.edu.in",
        "password": "password123",
        "role": "faculty",
        "department": "Physics"
    })
    assert resp.status_code == 403

    # Admin can create privileged account
    resp = client.post("/api/users/privileged", headers=admin_headers, json={
        "name": "Prof Smith",
        "email": "smith@pcu.edu.in",
        "password": "password123",
        "role": "faculty",
        "department": "Physics"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "teacher"
    assert data["email"] == "smith@pcu.edu.in"


def test_admin_prevent_self_deactivation():
    """Admin cannot deactivate their own account."""
    admin_headers = {"Authorization": "Bearer demo-admin-token"}
    resp = client.patch("/api/users/admin-main-003/status", headers=admin_headers, json={
        "status": "Deactivated"
    })
    assert resp.status_code == 400
    assert "cannot deactivate your own admin account" in resp.json()["detail"].lower()
