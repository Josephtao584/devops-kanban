from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from enums import RequirementStatus, RequirementPriority


# Base schemas
class RequirementBase(BaseModel):
    project_id: int
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: RequirementStatus = RequirementStatus.DRAFT
    priority: RequirementPriority = RequirementPriority.MEDIUM
    acceptance_criteria: Optional[str] = None
    created_by: Optional[str] = None


class RequirementCreate(RequirementBase):
    """Schema for creating a requirement"""

    pass


class RequirementUpdate(BaseModel):
    """Schema for updating a requirement"""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[RequirementStatus] = None
    priority: Optional[RequirementPriority] = None
    acceptance_criteria: Optional[str] = None
    created_by: Optional[str] = None


class RequirementResponse(RequirementBase):
    """Schema for requirement response"""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
