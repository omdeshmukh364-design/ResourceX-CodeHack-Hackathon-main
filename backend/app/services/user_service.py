import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from backend.app.config import settings
from backend.app.core.security import normalize_email, validate_student_email_domain
from backend.app.firebase import (
    check_firebase_auth_user_exists,
    create_firebase_auth_user,
    get_firestore_client,
)
from backend.app.models.user import (
    CreatePrivilegedUserRequest,
    StudentRegisterRequest,
    UserProfile,
    UserRole,
    UserStatus,
    UserStatusUpdateRequest,
)


class UserService:
    @staticmethod
    def register_student(req: StudentRegisterRequest) -> UserProfile:
        """
        Public student registration.
        Always creates role=student.
        Enforces strict @pcu.edu.in domain validation.
        Prevents duplicate registrations and enforces role-verification flow:
        Checks whether the existing account is a student, faculty, or admin.
        Never grants admin privileges during student registration, never overwrites
        or deletes existing accounts.
        """
        normalized_email = validate_student_email_domain(req.email)
        db = get_firestore_client()

        existing = list(db.collection("users").where("email", "==", normalized_email).limit(1).stream())
        auth_exists = check_firebase_auth_user_exists(normalized_email)
        if existing:
            from backend.app.firebase import is_live_firebase
            if is_live_firebase() and not auth_exists:
                raise HTTPException(409, detail="A profile already exists but its Firebase Authentication account is missing. Administrator reconciliation is required; no records were changed.")
            raise HTTPException(400, detail="This email is already registered. Please sign in or reset your password.")
        if auth_exists:
            raise HTTPException(400, detail="This email is already registered. Please sign in or reset your password. If profile setup was interrupted, sign in to recover it.")

        uid = f"student-{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # 3. Create user in Firebase Authentication if live Firebase is active
        try:
            create_firebase_auth_user(
                uid=uid,
                email=normalized_email,
                password=req.password,
                display_name=req.name.strip()
            )
        except ValueError as ve:
            if "EMAIL_ALREADY_EXISTS" in str(ve):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email is already registered. Please sign in or reset your password."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(ve)
            )

        # Durable server-owned recovery marker, never a client-provided role.
        from backend.app.firebase import is_live_firebase
        from firebase_admin import auth
        try:
            if is_live_firebase():
                auth.set_custom_user_claims(uid, {"student_registration": True})
            user_data = UserService.student_data(uid, normalized_email, req.name.strip(), req.department)
            db.collection("users").document(uid).create(user_data)
        except Exception:
            raise HTTPException(503, detail="Authentication account created, but profile setup is incomplete. Sign in to recover; if recovery fails contact an administrator. No account was deleted.") from None
        return UserProfile(**user_data)

    @staticmethod
    def student_data(uid, email, name, department=None):
        now = datetime.now(timezone.utc).isoformat()
        return dict(uid=uid, email=email, name=name, role="student", status="Active",
                    department=department or "Computer Science & Engineering",
                    email_verified=False, created_at=now, updated_at=now)

    @staticmethod
    def recover_student(payload):
        """Only a server-marked incomplete registration can recover its own profile."""
        from firebase_admin import auth
        from google.api_core.exceptions import AlreadyExists
        email = validate_student_email_domain(payload.get("email", ""))
        uid = payload["uid"]
        record = auth.get_user(uid)
        if record.disabled or record.email.lower() != email or not (record.custom_claims or {}).get("student_registration"):
            raise HTTPException(403, detail="This account requires administrator profile recovery.")
        ref = get_firestore_client().collection("users").document(uid)
        if not ref.get().exists:
            try:
                ref.create(UserService.student_data(uid, email, record.display_name or email.split("@")[0]))
            except AlreadyExists:
                pass
        profile = UserService.get_user(uid)
        if profile.role != UserRole.STUDENT or profile.status != UserStatus.ACTIVE:
            raise HTTPException(403, detail="Student recovery cannot change an existing role or account status.")
        return profile

    @staticmethod
    def get_user(uid: str) -> UserProfile:
        db = get_firestore_client()
        snap = db.collection("users").document(uid).get()
        if not snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return UserProfile(**snap.to_dict())

    @staticmethod
    def list_users(search: Optional[str] = None, role: Optional[str] = None) -> List[UserProfile]:
        db = get_firestore_client()
        docs = db.collection("users").stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            if not data:
                continue
            profile = UserProfile(**data)
            if role and profile.role.value != role:
                continue
            if search:
                s = search.lower()
                if s not in profile.name.lower() and s not in profile.email.lower():
                    continue
            results.append(profile)
        return results

    @staticmethod
    def update_user_status(target_uid: str, req: UserStatusUpdateRequest, current_admin: UserProfile) -> UserProfile:
        if target_uid == current_admin.uid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Safety check: You cannot deactivate your own admin account."
            )

        db = get_firestore_client()
        user_ref = db.collection("users").document(target_uid)
        snap = user_ref.get()
        if not snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        data = snap.to_dict()
        now_iso = datetime.now(timezone.utc).isoformat()
        data["status"] = req.status.value
        data["updated_at"] = now_iso
        user_ref.set(data, merge=True)
        import logging
        logging.getLogger(__name__).warning("account_status_changed actor=%s target=%s status=%s", current_admin.uid, target_uid, req.status.value)
        return UserProfile(**data)

    @staticmethod
    def create_privileged_user(req: CreatePrivilegedUserRequest, current_admin: UserProfile) -> UserProfile:
        """Only an authenticated Admin may create or approve Faculty and Admin accounts."""
        normalized_email = normalize_email(req.email)
        db = get_firestore_client()

        if req.role not in (UserRole.FACULTY, UserRole.ADMIN):
            raise HTTPException(400, detail="Provision only teacher or admin accounts.")
        existing = list(db.collection("users").where("email", "==", normalized_email).limit(1).stream())
        if existing or check_firebase_auth_user_exists(normalized_email):
            raise HTTPException(409, detail="An account with this email address already exists. Contact an administrator for reconciliation.")
        uid = f"{req.role.value}-{uuid.uuid4().hex}"
        create_firebase_auth_user(uid, normalized_email, req.password, req.name.strip())
        now = datetime.now(timezone.utc).isoformat()
        data = dict(uid=uid, email=normalized_email, name=req.name.strip(), role=req.role.value,
                    status="Active", department=req.department, email_verified=False,
                    created_at=now, updated_at=now)
        try:
            db.collection("users").document(uid).create(data)
        except Exception:
            raise HTTPException(503, detail="Auth account created; privileged profile provisioning incomplete. Administrator reconciliation required; do not retry with another account.") from None
        import logging
        logging.getLogger(__name__).warning("privileged_account_created actor=%s target=%s role=%s", current_admin.uid, uid, req.role.value)
        return UserProfile(**data)

    @staticmethod
    def bootstrap_admin(bootstrap_key: str, email: str, name: str, password: str) -> UserProfile:
        """One initial admin, serialized by a permanent Firestore bootstrap marker."""
        import secrets
        from firebase_admin import auth
        from backend.app.firebase import is_live_firebase
        if not settings.ENABLE_ADMIN_BOOTSTRAP or len(settings.ADMIN_BOOTSTRAP_KEY) < 32 or not secrets.compare_digest(bootstrap_key, settings.ADMIN_BOOTSTRAP_KEY):
            raise HTTPException(403, detail="Bootstrap is disabled or secret is invalid.")
        db = get_firestore_client()
        if list(db.collection("users").where("role", "==", "admin").limit(1).stream()):
            raise HTTPException(409, detail="An administrator already exists; use the authenticated admin workflow.")
        email = normalize_email(email)
        if list(db.collection("users").where("email", "==", email).limit(1).stream()) or check_firebase_auth_user_exists(email):
            raise HTTPException(409, detail="Existing account requires manual administrator reconciliation; bootstrap will not promote it.")
        marker = db.collection("system").document("admin_bootstrap")
        from google.api_core.exceptions import AlreadyExists
        try:
            marker.create({"started_at": datetime.now(timezone.utc).isoformat()})
        except AlreadyExists:
            raise HTTPException(409, detail="Bootstrap already started. Inspect Auth, profile and system/admin_bootstrap before manual recovery.") from None
        uid = f"admin-{uuid.uuid4().hex}"
        create_firebase_auth_user(uid, email, password, name)
        now = datetime.now(timezone.utc).isoformat()
        data = dict(uid=uid, email=email, name=name, role="admin", status="Active",
                    email_verified=False, created_at=now, updated_at=now)
        db.collection("users").document(uid).create(data)
        import logging
        logging.getLogger(__name__).warning("initial_admin_created target=%s", uid)
        return UserProfile(**data)
