from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from backend.app.config import settings
from backend.app.core.dependencies import get_current_user, require_faculty_or_admin
from backend.app.models.resource import ResourceCreate, ResourceResponse, ResourceUpdate
from backend.app.models.user import UserProfile
from backend.app.services.resource_service import ResourceService
from backend.app.services.seed_service import seed_database

router = APIRouter(prefix="/api/resources", tags=["Resources"])


@router.get("", response_model=List[ResourceResponse])
def list_resources(
    search: Optional[str] = Query(None, description="Search resources"),
    category: Optional[str] = Query(None, description="Category filter"),
    location: Optional[str] = Query(None, description="Location filter"),
    condition: Optional[str] = Query(None, description="Condition filter"),
    status: Optional[str] = Query(None, description="Availability status filter"),
    owner_uid: Optional[str] = Query(None, description="Filter by resource owner UID"),
):
    """Public/Student/Faculty/Admin browsing and searching of campus resources."""
    return ResourceService.list_resources(
        search=search,
        category=category,
        location=location,
        condition=condition,
        status_filter=status,
        owner_uid=owner_uid,
    )


@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(resource_id: str):
    """Retrieve details of a single resource."""
    return ResourceService.get_resource(resource_id)


@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    req: ResourceCreate,
    current_user: UserProfile = Depends(require_faculty_or_admin)
):
    """Faculty creates resource they own. Admin can create any resource."""
    return ResourceService.create_resource(req, current_user)


@router.patch("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: str,
    req: ResourceUpdate,
    current_user: UserProfile = Depends(require_faculty_or_admin)
):
    """Faculty can edit only their own resources. Admin can edit any resource."""
    return ResourceService.update_resource(resource_id, req, current_user)


@router.delete("/{resource_id}")
def delete_resource(
    resource_id: str,
    current_user: UserProfile = Depends(require_faculty_or_admin)
):
    """Faculty can delete only their own resources. Admin can delete any resource."""
    return ResourceService.delete_resource(resource_id, current_user)


