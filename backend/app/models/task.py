"""Task data model."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Task status enumeration."""

    REQUIREMENTS = "REQUIREMENTS"
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


class Priority(str, Enum):
    """Task priority enumeration."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class TaskBase(BaseModel):
    """Base task model."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    status: TaskStatus = Field(default=TaskStatus.TODO)
    priority: Priority = Field(default=Priority.MEDIUM)
    assignee: Optional[str] = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list)


class TaskCreate(TaskBase):
    """Task creation model."""

    project_id: int


class TaskUpdate(BaseModel):
    """Task update model."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[TaskStatus] = None
    priority: Optional[Priority] = None
    assignee: Optional[str] = Field(default=None, max_length=100)
    tags: Optional[list[str]] = None


class TaskStatusUpdate(BaseModel):
    """Task status update model."""

    status: TaskStatus


class Task(TaskBase):
    """Task model with ID and timestamps."""

    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskByStatus(BaseModel):
    """Tasks grouped by status."""

    REQUIREMENTS: list[Task] = Field(default_factory=list)
    TODO: list[Task] = Field(default_factory=list)
    IN_PROGRESS: list[Task] = Field(default_factory=list)
    DONE: list[Task] = Field(default_factory=list)
    BLOCKED: list[Task] = Field(default_factory=list)
    CANCELLED: list[Task] = Field(default_factory=list)
