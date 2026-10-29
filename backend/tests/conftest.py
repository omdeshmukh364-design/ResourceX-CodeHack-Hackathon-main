import os
os.environ["ENVIRONMENT"] = "test"
os.environ["ENABLE_ADMIN_BOOTSTRAP"] = "true"
os.environ["ADMIN_BOOTSTRAP_KEY"] = "unit-test-secret-only-32-characters-long"
import pytest
from backend.app.firebase import get_firestore_client

@pytest.fixture(autouse=True)
def isolated_verifier(monkeypatch):
    def verify(token):
        known = {
            "demo-student-token": ("student-jamie-001", "jamie@pcu.edu.in", "student", True),
            "demo-faculty-token": ("faculty-reynolds-002", "reynolds@pcu.edu.in", "teacher", True),
            "demo-admin-token": ("admin-main-003", "admin@pcu.edu.in", "admin", True),
        }
        if token in known:
            uid, email, role, verified = known[token]
        elif token.startswith("test-token:"):
            _, uid, email, role, verified = token.split(":")
            verified = verified == "true"
        else:
            raise ValueError("Invalid token")
        return dict(uid=uid, email=email, role=role, email_verified=verified)
    monkeypatch.setattr("backend.app.core.dependencies.verify_firebase_id_token", verify)
    monkeypatch.setattr("backend.app.routers.auth_router.verify_firebase_id_token", verify)

@pytest.fixture(autouse=True)
def extra_profiles(reset_db):
    from backend.app.services.user_service import UserService
    db = get_firestore_client()
    for uid, email, role in [("fac-99", "fac@pcu.edu.in", "teacher"), ("unverified-1", "unverified@pcu.edu.in", "student"),
                              ("faculty-other-999", "other@pcu.edu.in", "teacher")]:
        data = UserService.student_data(uid, email, uid)
        data["role"] = role
        db.collection("users").document(uid).set(data)
