from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from enums import TaskStatus, TaskPriority


# Base schemas
class TaskBase(BaseModel):
    project_id: int
    requirement_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee: Optional[str] = None


class TaskCreate(TaskBase):
    """Schema for creating a task"""

    pass


class TaskUpdate(BaseModel):
    """Schema for updating a task"""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee: Optional[str] = None
    requirement_id: Optional[int] = None


class TaskStatusUpdate(BaseModel):
    """Schema for updating task status only"""

    status: TaskStatus


class TaskResponse(TaskBase):
    """Schema for task response"""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
