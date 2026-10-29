from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    STUDENT = "student"
    FACULTY = "teacher"

    @classmethod
    def _missing_(cls, value):
        return cls.FACULTY if value == "faculty" else None
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "Active"
    DEACTIVATED = "Deactivated"


class UserProfile(BaseModel):
    uid: str
    email: str
    name: str
    role: UserRole
    status: UserStatus = UserStatus.ACTIVE
    department: Optional[str] = None
    email_verified: bool = False
    created_at: str
    updated_at: str


class StudentRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    department: Optional[str] = "Computer Science & Engineering"


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    department: Optional[str] = None


class UserStatusUpdateRequest(BaseModel):
    status: UserStatus


class UserRoleUpdateRequest(BaseModel):
    role: UserRole


class CreatePrivilegedUserRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole
    department: Optional[str] = None


class BootstrapAdminRequest(BaseModel):
    bootstrap_key: str
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = "Administrator"
