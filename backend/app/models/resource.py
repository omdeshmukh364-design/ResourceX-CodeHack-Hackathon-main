from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ResourceCondition(str, Enum):
    GOOD = "Good"
    DAMAGED = "Damaged"


class ResourceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    category: str = Field(..., min_length=2, max_length=50)
    type: str = Field(default="Equipment")  # Equipment, Space, Lab
    location: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=5, max_length=1000)
    image: Optional[str] = "/placeholder.svg"
    status: Optional[str] = "Available today"
    condition: ResourceCondition = ResourceCondition.GOOD
    quantity: int = Field(default=1, ge=1)


class ResourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    category: Optional[str] = Field(None, min_length=2, max_length=50)
    type: Optional[str] = None
    location: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, min_length=5, max_length=1000)
    image: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[ResourceCondition] = None
    quantity: Optional[int] = Field(None, ge=1)
    available_quantity: Optional[int] = Field(None, ge=0)


class ResourceResponse(BaseModel):
    id: str
    name: str
    category: str
    type: str
    location: str
    description: str
    image: str
    status: str
    condition: str
    quantity: int
    available_quantity: int
    owner_uid: str
    owner_name: str
    created_at: str
    updated_at: str
