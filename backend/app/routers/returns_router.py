from typing import List
from fastapi import APIRouter, Depends
from backend.app.core.dependencies import get_current_user
from backend.app.models.booking import ReturnRecordResponse
from backend.app.models.user import UserProfile
from backend.app.services.booking_service import BookingService

router = APIRouter(prefix="/api/returns", tags=["Returns"])


@router.get("", response_model=List[ReturnRecordResponse])
def list_returns(current_user: UserProfile = Depends(get_current_user)):
    """List return records with condition and damage audit history."""
    return BookingService.list_returns(current_user)
