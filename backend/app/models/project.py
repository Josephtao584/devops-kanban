"""Project data model."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    """Base project model."""

    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    git_url: Optional[str] = Field(default=None, max_length=500)
    local_path: Optional[str] = Field(default=None, max_length=500)


class ProjectCreate(ProjectBase):
    """Project creation model."""

    pass


class ProjectUpdate(BaseModel):
    """Project update model."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    git_url: Optional[str] = Field(default=None, max_length=500)
    local_path: Optional[str] = Field(default=None, max_length=500)


class Project(ProjectBase):
    """Project model with ID and timestamps."""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectWithStats(Project):
    """Project with task statistics."""

    task_count: int = 0
    todo_count: int = 0
    in_progress_count: int = 0
    done_count: int = 0
