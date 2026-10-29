import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from backend.app.firebase import get_firestore_client
from backend.app.models.resource import ResourceCreate, ResourceResponse, ResourceUpdate
from backend.app.models.user import UserProfile, UserRole


class ResourceService:
    @staticmethod
    def list_resources(
        search: Optional[str] = None,
        category: Optional[str] = None,
        location: Optional[str] = None,
        condition: Optional[str] = None,
        status_filter: Optional[str] = None,
        owner_uid: Optional[str] = None,
    ) -> List[ResourceResponse]:
        db = get_firestore_client()
        docs = db.collection("resources").stream()
        results = []

        for doc in docs:
            data = doc.to_dict()
            if not data:
                continue

            # Filtering
            if owner_uid and data.get("owner_uid") != owner_uid:
                continue
            if category and category.lower() != "all":
                if data.get("category", "").lower() != category.lower() and data.get("type", "").lower() != category.lower():
                    continue
            if location and location.lower() not in data.get("location", "").lower():
                continue
            if condition and data.get("condition", "").lower() != condition.lower():
                continue
            if status_filter and status_filter.lower() not in data.get("status", "").lower():
                continue
            if search:
                s = search.lower()
                name_match = s in data.get("name", "").lower()
                desc_match = s in data.get("description", "").lower()
                cat_match = s in data.get("category", "").lower()
                loc_match = s in data.get("location", "").lower()
                if not (name_match or desc_match or cat_match or loc_match):
                    continue

            results.append(ResourceResponse(**data))

        # Sort by updated_at descending
        results.sort(key=lambda r: r.updated_at, reverse=True)
        return results

    @staticmethod
    def get_resource(resource_id: str) -> ResourceResponse:
        db = get_firestore_client()
        snap = db.collection("resources").document(resource_id).get()
        if not snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
        return ResourceResponse(**snap.to_dict())

    @staticmethod
    def create_resource(req: ResourceCreate, current_user: UserProfile) -> ResourceResponse:
        """
        Faculty can create resources (owned by them).
        Admin can create resources.
        Students cannot create resources.
        """
        if current_user.role not in (UserRole.FACULTY, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students cannot create resources. Only Faculty and Admin may list items."
            )

        db = get_firestore_client()
        resource_id = f"res-{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        data = {
            "id": resource_id,
            "name": req.name.strip(),
            "category": req.category.strip(),
            "type": req.type or "Equipment",
            "location": req.location.strip(),
            "description": req.description.strip(),
            "image": req.image or "/placeholder.svg",
            "status": req.status or "Available today",
            "condition": req.condition.value,
            "quantity": req.quantity,
            "available_quantity": req.quantity,
            "owner_uid": current_user.uid,
            "owner_name": current_user.name,
            "created_at": now_iso,
            "updated_at": now_iso
        }

        db.collection("resources").document(resource_id).set(data)
        return ResourceResponse(**data)

    @staticmethod
    def update_resource(resource_id: str, req: ResourceUpdate, current_user: UserProfile) -> ResourceResponse:
        """
        Faculty can edit only their own resources.
        Admin can edit all resources.
        """
        db = get_firestore_client()
        doc_ref = db.collection("resources").document(resource_id)
        snap = doc_ref.get()
        if not snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

        data = snap.to_dict()

        if current_user.role != UserRole.ADMIN and data.get("owner_uid") != current_user.uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Faculty can modify only their own resources."
            )

        update_dict = req.model_dump(exclude_unset=True)
        if any(v is None for v in update_dict.values()):
            raise HTTPException(422, detail="Resource fields cannot be null.")
        if update_dict.get("available_quantity", data["available_quantity"]) > update_dict.get("quantity", data["quantity"]):
            raise HTTPException(422, detail="Available quantity cannot exceed total quantity.")
        if "condition" in update_dict and update_dict["condition"]:
            update_dict["condition"] = update_dict["condition"].value

        now_iso = datetime.now(timezone.utc).isoformat()
        update_dict["updated_at"] = now_iso

        data.update(update_dict)
        doc_ref.set(data, merge=True)
        return ResourceResponse(**data)

    @staticmethod
    def delete_resource(resource_id: str, current_user: UserProfile) -> dict:
        """
        Faculty can delete only their own resources.
        Admin can delete all resources.
        """
        db = get_firestore_client()
        doc_ref = db.collection("resources").document(resource_id)
        snap = doc_ref.get()
        if not snap.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

        data = snap.to_dict()

        if current_user.role != UserRole.ADMIN and data.get("owner_uid") != current_user.uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Faculty can delete only their own resources."
            )

        bookings = db.collection("bookings").where("resource_id", "==", resource_id).stream()
        if any(b.to_dict().get("status") in ("pending", "approved", "checked_out") for b in bookings):
            raise HTTPException(409, detail="Cannot delete a resource with active bookings.")
        doc_ref.delete()
        return {"status": "success", "message": f"Resource '{data.get('name')}' deleted successfully."}
