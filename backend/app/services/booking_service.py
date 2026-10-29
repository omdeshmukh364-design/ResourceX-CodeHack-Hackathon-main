import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from backend.app.firebase import get_firestore_client
from backend.app.models.booking import (
    BookingApproval,
    BookingCheckout,
    BookingCreate,
    BookingRejection,
    BookingResponse,
    BookingReturn,
    BookingStatus,
    ReturnRecordResponse,
)
from backend.app.models.user import UserProfile, UserRole


def parse_iso(dt_str: str) -> datetime:
    """Parse ISO 8601 UTC timestamp."""
    try:
        # Replace Z with +00:00 for fromisoformat compatibility
        clean = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ISO 8601 timestamp: '{dt_str}'. Use UTC format e.g. '2026-10-31T10:00:00Z'."
        )


def check_intervals_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    """Returns True if two time intervals overlap (start_a < end_b and start_b < end_a)."""
    return max(start_a, start_b) < min(end_a, end_b)


class BookingService:
    @staticmethod
    def create_booking(req: BookingCreate, current_user: UserProfile) -> BookingResponse:
        """
        Student creates a booking request.
        Validates date ranges: start_time < end_time, start_time in future.
        Checks resource exists and is active.
        """
        start_dt = parse_iso(req.start_time)
        end_dt = parse_iso(req.end_time)

        if start_dt >= end_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking start time must be strictly before end time."
            )

        db = get_firestore_client()
        res_ref = db.collection("resources").document(req.resource_id)
        res_snap = res_ref.get()
        if not res_snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

        res_data = res_snap.to_dict()
        if res_data.get("condition") == "Damaged" or res_data.get("status") in ("Maintenance Required", "Unavailable", "In Use"):
            raise HTTPException(409, detail="Resource is not available for booking.")

        booking_id = f"book-{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        booking_data = {
            "id": booking_id,
            "resource_id": req.resource_id,
            "resource_name": res_data.get("name", "Unknown Resource"),
            "resource_image": res_data.get("image", "/placeholder.svg"),
            "resource_location": res_data.get("location", ""),
            "requester_uid": current_user.uid,
            "requester_name": current_user.name,
            "requester_email": current_user.email,
            "owner_uid": res_data.get("owner_uid", ""),
            "start_time": start_dt.isoformat(),
            "end_time": end_dt.isoformat(),
            "purpose": req.purpose.strip(),
            "status": BookingStatus.PENDING.value,
            "rejection_reason": None,
            "approval_notes": None,
            "approved_by": None,
            "approved_at": None,
            "checked_out_by": None,
            "checked_out_at": None,
            "returned_at": None,
            "return_condition": None,
            "damage_notes": None,
            "created_at": now_iso,
            "updated_at": now_iso
        }

        db.collection("bookings").document(booking_id).set(booking_data)
        return BookingResponse(**booking_data)

    @staticmethod
    def approve_booking(booking_id: str, req: BookingApproval, current_user: UserProfile) -> BookingResponse:
        """
        Faculty (owner) or Admin approves a pending booking.
        Uses transaction-safe checking to prevent overlapping approved bookings.
        """
        db = get_firestore_client()
        from backend.app.firebase import run_transaction
        def approve(tx):

            booking_ref = db.collection("bookings").document(booking_id)
            booking_snap = booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

            booking_data = booking_snap.to_dict()
            if booking_data["status"] != BookingStatus.PENDING.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot approve booking in status '{booking_data['status']}'. Only 'pending' bookings can be approved."
                )

            # Check permissions: must be owner or admin
            if current_user.role != UserRole.ADMIN and booking_data["owner_uid"] != current_user.uid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the resource owner or an administrator can approve this booking."
                )

            resource_id = booking_data["resource_id"]
            lock_ref = db.collection("resource_locks").document(resource_id)
            lock_snap = lock_ref.get(transaction=tx)

            b_start = parse_iso(booking_data["start_time"])
            b_end = parse_iso(booking_data["end_time"])

            # Fetch existing active bookings for this resource to prevent double-booking
            active_bookings = list(db.collection("bookings").where("resource_id", "==", resource_id).stream(transaction=tx))
            for existing in active_bookings:
                e_data = existing.to_dict()
                if existing.id == booking_id:
                    continue
                if e_data.get("status") in (BookingStatus.APPROVED.value, BookingStatus.CHECKED_OUT.value):
                    e_start = parse_iso(e_data["start_time"])
                    e_end = parse_iso(e_data["end_time"])
                    if check_intervals_overlap(b_start, b_end, e_start, e_end):
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Conflict: Resource is already booked between {e_data['start_time']} and {e_data['end_time']}."
                        )

            now_iso = datetime.now(timezone.utc).isoformat()
            booking_data["status"] = BookingStatus.APPROVED.value
            booking_data["approved_by"] = current_user.uid
            booking_data["approved_at"] = now_iso
            booking_data["approval_notes"] = req.notes
            booking_data["updated_at"] = now_iso

            tx.update(booking_ref, booking_data)

            # Update resource lock record
            lock_data = lock_snap.to_dict() if lock_snap.exists else {"resource_id": resource_id, "active_booking_ids": []}
            active_ids = lock_data.get("active_booking_ids", [])
            if booking_id not in active_ids:
                active_ids.append(booking_id)
            lock_data["active_booking_ids"] = active_ids
            lock_data["last_updated"] = now_iso
            tx.set(lock_ref, lock_data, merge=True)

            return BookingResponse(**booking_data)

        return run_transaction(db, approve)

    @staticmethod
    def reject_booking(booking_id: str, req: BookingRejection, current_user: UserProfile) -> BookingResponse:
        """Faculty (owner) or Admin rejects a pending booking."""
        from backend.app.firebase import run_transaction
        db = get_firestore_client()
        def transition(tx):
            booking_ref = db.collection("bookings").document(booking_id)
            booking_snap = booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

            booking_data = booking_snap.to_dict()
            if booking_data["status"] != BookingStatus.PENDING.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot reject booking in status '{booking_data['status']}'."
                )

            if current_user.role != UserRole.ADMIN and booking_data["owner_uid"] != current_user.uid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the resource owner or an administrator can reject this booking."
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            booking_data["status"] = BookingStatus.REJECTED.value
            booking_data["rejection_reason"] = req.reason
            booking_data["updated_at"] = now_iso

            tx.set(booking_ref, booking_data, merge=True)
            return BookingResponse(**booking_data)

        return run_transaction(db, transition)

    @staticmethod
    def cancel_booking(booking_id: str, current_user: UserProfile) -> BookingResponse:
        """
        Student cancels their own booking (if pending or approved before checkout).
        Admin can cancel any eligible booking.
        """
        from backend.app.firebase import run_transaction
        db = get_firestore_client()
        def transition(tx):
            booking_ref = db.collection("bookings").document(booking_id)
            booking_snap = booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

            booking_data = booking_snap.to_dict()
            if current_user.role != UserRole.ADMIN and booking_data["requester_uid"] != current_user.uid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: You can only cancel your own booking."
                )

            if booking_data["status"] not in (BookingStatus.PENDING.value, BookingStatus.APPROVED.value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot cancel booking with status '{booking_data['status']}'. Only 'pending' or 'approved' bookings may be cancelled."
                )

            resource_id = booking_data["resource_id"]
            lock_ref = db.collection("resource_locks").document(resource_id)
            lock_snap = lock_ref.get(transaction=tx)
            now_iso = datetime.now(timezone.utc).isoformat()
            booking_data["status"] = BookingStatus.CANCELLED.value
            booking_data["updated_at"] = now_iso

            tx.set(booking_ref, booking_data, merge=True)

            # Release from resource locks if present
            if lock_snap.exists:
                lock_data = lock_snap.to_dict()
                active_ids = lock_data.get("active_booking_ids", [])
                if booking_id in active_ids:
                    active_ids.remove(booking_id)
                    lock_data["active_booking_ids"] = active_ids
                    lock_data["last_updated"] = now_iso
                    tx.set(lock_ref, lock_data, merge=True)

            return BookingResponse(**booking_data)

        return run_transaction(db, transition)

    @staticmethod
    def checkout_booking(booking_id: str, req: BookingCheckout, current_user: UserProfile) -> BookingResponse:
        """
        Authorized checkout: transitions booking from 'approved' -> 'checked_out'.
        Can be performed by resource owner or Admin.
        """
        from backend.app.firebase import run_transaction
        db = get_firestore_client()
        def transition(tx):
            booking_ref = db.collection("bookings").document(booking_id)
            booking_snap = booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

            booking_data = booking_snap.to_dict()
            if booking_data["status"] != BookingStatus.APPROVED.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot check out booking with status '{booking_data['status']}'. Booking must be 'approved' first."
                )

            if current_user.role != UserRole.ADMIN and booking_data["owner_uid"] != current_user.uid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the resource owner or Admin can process checkouts."
                )

            res_ref = db.collection("resources").document(booking_data["resource_id"])
            res_snap = res_ref.get(transaction=tx)
            now_iso = datetime.now(timezone.utc).isoformat()
            booking_data["status"] = BookingStatus.CHECKED_OUT.value
            booking_data["checked_out_by"] = current_user.uid
            booking_data["checked_out_at"] = now_iso
            booking_data["updated_at"] = now_iso

            tx.set(booking_ref, booking_data, merge=True)

            # Update resource status
            if res_snap.exists:
                r_data = res_snap.to_dict()
                r_data["status"] = "In Use"
                r_data["updated_at"] = now_iso
                tx.set(res_ref, r_data, merge=True)

            return BookingResponse(**booking_data)

        return run_transaction(db, transition)

    @staticmethod
    def return_booking(booking_id: str, req: BookingReturn, current_user: UserProfile) -> ReturnRecordResponse:
        """
        Authorized return: transitions booking from 'checked_out' -> 'returned'.
        Records condition ('Good' or 'Damaged') and damage notes.
        Creates record in 'returns/{return_id}'.
        Updates resource availability and condition.
        """
        from backend.app.firebase import run_transaction
        db = get_firestore_client()
        def transition(tx):
            booking_ref = db.collection("bookings").document(booking_id)
            booking_snap = booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

            booking_data = booking_snap.to_dict()
            if booking_data["status"] != BookingStatus.CHECKED_OUT.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot return booking with status '{booking_data['status']}'. Booking must be 'checked_out'."
                )

            if current_user.role != UserRole.ADMIN and booking_data["owner_uid"] != current_user.uid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the resource owner or Admin can process returns."
                )

            resource_id = booking_data["resource_id"]
            lock_ref = db.collection("resource_locks").document(resource_id)
            lock_snap = lock_ref.get(transaction=tx)
            res_ref = db.collection("resources").document(resource_id)
            res_snap = res_ref.get(transaction=tx)
            now_iso = datetime.now(timezone.utc).isoformat()
            cond = "Damaged" if req.condition.lower() == "damaged" else "Good"

            booking_data["status"] = BookingStatus.RETURNED.value
            booking_data["returned_at"] = now_iso
            booking_data["return_condition"] = cond
            booking_data["damage_notes"] = req.damage_notes
            booking_data["updated_at"] = now_iso
            tx.set(booking_ref, booking_data, merge=True)

            # Release from resource locks
            if lock_snap.exists:
                lock_data = lock_snap.to_dict()
                active_ids = lock_data.get("active_booking_ids", [])
                if booking_id in active_ids:
                    active_ids.remove(booking_id)
                    lock_data["active_booking_ids"] = active_ids
                    lock_data["last_updated"] = now_iso
                    tx.set(lock_ref, lock_data, merge=True)

            # Update resource status & condition
            if res_snap.exists:
                r_data = res_snap.to_dict()
                if cond == "Damaged":
                    r_data["condition"] = "Damaged"
                    r_data["status"] = "Maintenance Required"
                else:
                    r_data["status"] = "Available today"
                r_data["updated_at"] = now_iso
                tx.set(res_ref, r_data, merge=True)

            # Create record in 'returns' collection
            return_id = f"ret-{uuid.uuid4().hex[:12]}"
            return_data = {
                "id": return_id,
                "booking_id": booking_id,
                "resource_id": resource_id,
                "resource_name": booking_data.get("resource_name", ""),
                "borrower_uid": booking_data.get("requester_uid", ""),
                "borrower_name": booking_data.get("requester_name", ""),
                "processed_by_uid": current_user.uid,
                "processed_by_name": current_user.name,
                "return_condition": cond,
                "damage_notes": req.damage_notes,
                "returned_at": now_iso,
                "created_at": now_iso
            }
            tx.set(db.collection("returns").document(return_id), return_data)

            return ReturnRecordResponse(**return_data)

        return run_transaction(db, transition)

    @staticmethod
    def list_bookings(
        current_user: UserProfile,
        status_filter: Optional[str] = None,
        requester_uid: Optional[str] = None,
        owner_uid: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> List[BookingResponse]:
        db = get_firestore_client()
        docs = db.collection("bookings").stream()
        results = []

        for doc in docs:
            data = doc.to_dict()
            if not data:
                continue

            # Role-based visibility:
            # Students can view only their own bookings
            # Faculty can view bookings for their resources or their own
            # Admin can view all
            if current_user.role == UserRole.STUDENT and data.get("requester_uid") != current_user.uid:
                continue
            if current_user.role == UserRole.FACULTY and data.get("owner_uid") != current_user.uid and data.get("requester_uid") != current_user.uid:
                continue

            if status_filter and data.get("status") != status_filter:
                continue
            if requester_uid and data.get("requester_uid") != requester_uid:
                continue
            if owner_uid and data.get("owner_uid") != owner_uid:
                continue
            if resource_id and data.get("resource_id") != resource_id:
                continue

            results.append(BookingResponse(**data))

        # Sort by created_at descending
        results.sort(key=lambda b: b.created_at, reverse=True)
        return results

    @staticmethod
    def list_returns(current_user: UserProfile) -> List[ReturnRecordResponse]:
        db = get_firestore_client()
        docs = db.collection("returns").stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            if not data:
                continue
            # Resolve historical owner through the booking, including older return records.
            if current_user.role == UserRole.FACULTY:
                booking = db.collection("bookings").document(data.get("booking_id", "missing")).get()
                if not booking.exists or booking.to_dict().get("owner_uid") != current_user.uid:
                    continue
            # Non-admins only see returns for resources they own or borrowed
            if current_user.role == UserRole.STUDENT and data.get("borrower_uid") != current_user.uid:
                continue
            results.append(ReturnRecordResponse(**data))

        results.sort(key=lambda r: r.returned_at, reverse=True)
        return results
