"""TaskSource data model."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TaskSourceType(str, Enum):
    """Task source type enumeration."""

    GITHUB = "GITHUB"
    JIRA = "JIRA"
    GITLAB = "GITLAB"
    LINEAR = "LINEAR"


class TaskSourceBase(BaseModel):
    """Base task source model."""

    name: str = Field(..., min_length=1, max_length=100)
    type: TaskSourceType
    project_id: int
    config: dict = Field(default_factory=dict)
    enabled: bool = Field(default=True)
    sync_interval: Optional[int] = Field(default=None, description="Sync interval in minutes")


class TaskSourceCreate(TaskSourceBase):
    """Task source creation model."""

    pass


class TaskSourceUpdate(BaseModel):
    """Task source update model."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    config: Optional[dict] = None
    enabled: Optional[bool] = None
    sync_interval: Optional[int] = None


class TaskSource(TaskSourceBase):
    """Task source model with ID and timestamps."""

    id: int
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
