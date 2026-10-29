from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from backend.app.core.dependencies import get_current_user, require_admin
from backend.app.models.user import (
    CreatePrivilegedUserRequest,
    UserProfile,
    UserStatusUpdateRequest,
)
from backend.app.services.user_service import UserService

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("", response_model=List[UserProfile])
def list_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role: student, faculty, admin"),
    current_admin: UserProfile = Depends(require_admin)
):
    """Admin-only: list all platform users."""
    return UserService.list_users(search=search, role=role)


@router.get("/{uid}", response_model=UserProfile)
def get_user_profile(
    uid: str,
    current_user: UserProfile = Depends(get_current_user)
):
    """Retrieve user profile by UID."""
    if current_user.uid != uid and current_user.role.value != "admin":
        raise HTTPException(403, detail="Cannot view another user profile.")
    return UserService.get_user(uid)


@router.patch("/{uid}/status", response_model=UserProfile)
def update_user_status(
    uid: str,
    req: UserStatusUpdateRequest,
    current_admin: UserProfile = Depends(require_admin)
):
    """Admin-only: activate or deactivate a user account (prevents admin self-deactivation)."""
    return UserService.update_user_status(target_uid=uid, req=req, current_admin=current_admin)


@router.post("/privileged", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def create_privileged_account(
    req: CreatePrivilegedUserRequest,
    current_admin: UserProfile = Depends(require_admin)
):
    """Admin-only: provision Faculty or Admin accounts."""
    return UserService.create_privileged_user(req=req, current_admin=current_admin)
