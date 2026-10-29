from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.app.config import settings
from backend.app.core.security import normalize_email, validate_student_email_domain
from backend.app.firebase import get_firestore_client, verify_firebase_id_token
from backend.app.models.user import UserProfile, UserRole, UserStatus

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> UserProfile:
    """
    Extract and verify the Firebase ID Token from Authorization header.
    Never trusts client-supplied headers or body for identity, verification status, or role.
    Fetches the authoritative user profile from Firestore.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token. Provide Bearer <token>.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = verify_firebase_id_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, disabled, revoked or expired authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid = payload.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: UID missing."
        )

    authenticated_email = normalize_email(payload.get("email", ""))
    token_email_verified = payload.get("email_verified", False)

    db = get_firestore_client()
    user_ref = db.collection("users").document(uid)
    snap = user_ref.get()

    now_iso = datetime.now(timezone.utc).isoformat()

    if not snap.exists:
        raise HTTPException(403, detail="Profile missing. Complete student registration recovery or contact an administrator.")
    data = snap.to_dict() or {}
    if data.get("uid") != uid or normalize_email(data.get("email", "")) != authenticated_email:
        raise HTTPException(403, detail="Account profile does not match the verified identity.")
    try:
        data["email_verified"] = token_email_verified
        profile = UserProfile(**data)
    except Exception:
        raise HTTPException(403, detail="Invalid account profile. Contact an administrator.") from None
    if profile.role == UserRole.STUDENT:
        validate_student_email_domain(profile.email)
        if settings.REQUIRE_EMAIL_VERIFICATION and not token_email_verified:
            raise HTTPException(403, detail="Email verification required. Verify your email and sign in again.")

    # Check if user account is deactivated
    if profile.status == UserStatus.DEACTIVATED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact the administrator."
        )

    return profile


def require_verified_student(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """
    Enforces that the user is a Student, with a strictly verified official college email (@pcu.edu.in).
    Rejects unauthorized domains, personal emails, and unverified accounts.
    """
    if user.role != UserRole.STUDENT:
        raise HTTPException(403, detail="Student privileges required.")

    # Strictly validate domain for student
    if user.role == UserRole.STUDENT:
        validate_student_email_domain(user.email)
        if settings.REQUIRE_EMAIL_VERIFICATION and not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required. Please verify your official college email address (@pcu.edu.in) before accessing Student features."
            )

    return user


def require_faculty_or_admin(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Enforces that the authenticated user has Faculty or Admin role."""
    if user.role not in (UserRole.FACULTY, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Requires Faculty or Admin privileges."
        )
    return user


def require_admin(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Enforces that the authenticated user has Admin role."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrator privilege required."
        )
    return user
