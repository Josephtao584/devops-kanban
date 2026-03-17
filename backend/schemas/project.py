from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


# Base schemas
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    repository_url: Optional[str] = Field(None, max_length=500)
    local_path: Optional[str] = Field(None, max_length=500)


class ProjectCreate(ProjectBase):
    """Schema for creating a project"""

    pass


class ProjectUpdate(BaseModel):
    """Schema for updating a project"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    repository_url: Optional[str] = Field(None, max_length=500)
    local_path: Optional[str] = Field(None, max_length=500)


class ProjectResponse(ProjectBase):
    """Schema for project response"""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
