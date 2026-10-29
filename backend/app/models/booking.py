from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field


class BookingStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHECKED_OUT = "checked_out"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class BookingCreate(BaseModel):
    resource_id: str
    start_time: str = Field(..., description="ISO 8601 UTC timestamp")
    end_time: str = Field(..., description="ISO 8601 UTC timestamp")
    purpose: str = Field(..., min_length=3, max_length=500)


class BookingApproval(BaseModel):
    notes: Optional[str] = None


class BookingRejection(BaseModel):
    reason: Optional[str] = None


class BookingCheckout(BaseModel):
    notes: Optional[str] = None


class BookingReturn(BaseModel):
    condition: Literal["Good", "Damaged"] = Field("Good", description="'Good' or 'Damaged'")
    damage_notes: Optional[str] = None


class BookingResponse(BaseModel):
    id: str
    resource_id: str
    resource_name: str
    resource_image: Optional[str] = None
    resource_location: Optional[str] = None
    requester_uid: str
    requester_name: str
    requester_email: str
    owner_uid: str
    start_time: str
    end_time: str
    purpose: str
    status: BookingStatus
    rejection_reason: Optional[str] = None
    approval_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    checked_out_by: Optional[str] = None
    checked_out_at: Optional[str] = None
    returned_at: Optional[str] = None
    return_condition: Optional[str] = None
    damage_notes: Optional[str] = None
    created_at: str
    updated_at: str


class ReturnRecordResponse(BaseModel):
    id: str
    booking_id: str
    resource_id: str
    resource_name: str
    borrower_uid: str
    borrower_name: str
    processed_by_uid: str
    processed_by_name: str
    return_condition: str
    damage_notes: Optional[str] = None
    returned_at: str
    created_at: str
