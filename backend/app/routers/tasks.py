"""Task API router."""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.models import TaskCreate, TaskStatusUpdate, TaskUpdate
from app.services.task_service import TaskService

router = APIRouter()

# Service instance
service = TaskService()


def success_response(data: Any = None, message: str = "Success") -> dict:
    """Create a success response."""
    return {"success": True, "message": message, "data": data}


def error_response(message: str) -> dict:
    """Create an error response."""
    return {"success": False, "message": message, "data": None}


@router.get("")
async def get_all_tasks() -> dict:
    """Get all tasks."""
    tasks = service.get_all()
    return success_response([t.model_dump() for t in tasks])


@router.get("/{task_id}")
async def get_task(task_id: int) -> dict:
    """Get task by ID."""
    task = service.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return success_response(task.model_dump())


@router.post("")
async def create_task(task: TaskCreate) -> dict:
    """Create a new task."""
    # Verify project exists
    from app.services.project_service import ProjectService

    project_service = ProjectService()
    if not project_service.exists(task.project_id):
        raise HTTPException(status_code=400, detail="Project not found")

    new_task = service.create(task)
    return success_response(new_task.model_dump(), "Task created successfully")


@router.put("/{task_id}")
async def update_task(task_id: int, task: TaskUpdate) -> dict:
    """Update a task."""
    updated = service.update(task_id, task)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return success_response(updated.model_dump(), "Task updated successfully")


@router.patch("/{task_id}/status")
async def update_task_status(task_id: int, status_data: TaskStatusUpdate) -> dict:
    """Update task status."""
    updated = service.update_status(task_id, status_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return success_response(updated.model_dump(), "Task status updated successfully")


@router.delete("/{task_id}")
async def delete_task(task_id: int) -> dict:
    """Delete a task."""
    if not service.delete(task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return success_response(None, "Task deleted successfully")
