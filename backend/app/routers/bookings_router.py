from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from backend.app.core.dependencies import (
    get_current_user,
    require_faculty_or_admin,
    require_verified_student,
)
from backend.app.models.booking import (
    BookingApproval,
    BookingCheckout,
    BookingCreate,
    BookingRejection,
    BookingResponse,
    BookingReturn,
    ReturnRecordResponse,
)
from backend.app.models.user import UserProfile
from backend.app.services.booking_service import BookingService

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking_request(
    req: BookingCreate,
    current_user: UserProfile = Depends(require_verified_student)
):
    """
    Student submits a booking request for a campus resource.
    Requires official verified @pcu.edu.in email.
    """
    return BookingService.create_booking(req, current_user)


@router.get("", response_model=List[BookingResponse])
def list_bookings(
    status: Optional[str] = Query(None, description="Filter by status (pending, approved, rejected, checked_out, returned, cancelled)"),
    requester_uid: Optional[str] = Query(None, description="Filter by requester UID"),
    owner_uid: Optional[str] = Query(None, description="Filter by owner UID"),
    resource_id: Optional[str] = Query(None, description="Filter by resource ID"),
    current_user: UserProfile = Depends(get_current_user)
):
    """
    List bookings based on user permissions:
    - Students see only their own bookings
    - Faculty see bookings for their resources
    - Admin sees all platform bookings
    """
    return BookingService.list_bookings(
        current_user=current_user,
        status_filter=status,
        requester_uid=requester_uid,
        owner_uid=owner_uid,
        resource_id=resource_id,
    )


@router.post("/{booking_id}/approve", response_model=BookingResponse)
def approve_booking(
    booking_id: str,
    req: BookingApproval = BookingApproval(),
    current_user: UserProfile = Depends(require_faculty_or_admin)
):
    """Faculty (resource owner) or Admin approves booking with transaction double-booking check."""
    return BookingService.approve_booking(booking_id, req, current_user)


@router.post("/{booking_id}/reject", response_model=BookingResponse)
def reject_booking(
    booking_id: str,
    req: BookingRejection = BookingRejection(),
    current_user: UserProfile = Depends(require_faculty_or_admin)
):
    """Faculty (resource owner) or Admin rejects booking."""
    return BookingService.reject_booking(booking_id, req, current_user)


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    """Student cancels their pending or approved booking. Admin can cancel any eligible booking."""
    return BookingService.cancel_booking(booking_id, current_user)


@router.post("/{booking_id}/checkout", response_model=BookingResponse)
def checkout_booking(
    booking_id: str,
    req: BookingCheckout = BookingCheckout(),
    current_user: UserProfile = Depends(require_faculty_or_admin)
):
    """Authorized checkout for an approved booking."""
    return BookingService.checkout_booking(booking_id, req, current_user)


@router.post("/{booking_id}/return", response_model=ReturnRecordResponse)
def process_return(
    booking_id: str,
    req: BookingReturn,
    current_user: UserProfile = Depends(require_faculty_or_admin)
):
    """Process return: records condition ('Good' or 'Damaged') and optional damage notes."""
    return BookingService.return_booking(booking_id, req, current_user)
