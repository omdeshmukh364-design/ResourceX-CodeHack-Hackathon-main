from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials

from backend.app.config import settings
from backend.app.core.dependencies import get_current_user, security
from backend.app.firebase import verify_firebase_id_token
from backend.app.models.user import (
    BootstrapAdminRequest,
    StudentRegisterRequest,
    UserProfile,
)
from backend.app.services.user_service import UserService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/policy")
def get_auth_policy():
    """Return the backend Firebase project and student authentication policy."""
    return {
        "firebase_project_id": settings.FIREBASE_PROJECT_ID,
        "allowed_student_domains": settings.allowed_domains,
        "official_college_domain": "pcu.edu.in",
        "email_verification_required": settings.REQUIRE_EMAIL_VERIFICATION,
        "policy_description": (
            "Students may register and access protected ResourceX features "
            "only using an approved official college email address."
        ),
    }


@router.post(
    "/register",
    response_model=UserProfile,
    status_code=status.HTTP_201_CREATED,
)
def register_student(req: StudentRegisterRequest):
    """Public registration that creates student accounts only."""
    return UserService.register_student(req)


@router.get("/me", response_model=UserProfile)
def get_current_authenticated_user(
    expected_role: str | None = Query(None),
    current_user: UserProfile = Depends(get_current_user),
):
    """Return the verified user's authoritative profile."""
    if expected_role is not None:
        if expected_role not in {"student", "teacher", "admin"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid login role. Choose student, teacher or admin.",
            )

        if current_user.role.value != expected_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "This account is not authorized for the selected login role."
                ),
            )

    return current_user


@router.post("/bootstrap-admin", response_model=UserProfile)
def bootstrap_admin_account(req: BootstrapAdminRequest):
    """
    Create the initial administrator.

    UserService enforces bootstrap enablement, secret validation,
    and one-time provisioning safeguards.
    """
    return UserService.bootstrap_admin(
        bootstrap_key=req.bootstrap_key,
        email=req.email,
        name=req.name,
        password=req.password,
    )


@router.post("/recover-student", response_model=UserProfile)
def recover_student(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """Recover an incomplete, server-marked student registration."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = verify_firebase_id_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    return UserService.recover_student(payload)