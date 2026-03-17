from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List


# Base schemas
class RoleBase(BaseModel):
    project_id: int
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)


class RoleCreate(RoleBase):
    """Schema for creating a role"""

    pass


class RoleUpdate(BaseModel):
    """Schema for updating a role"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleResponse(RoleBase):
    """Schema for role response"""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
