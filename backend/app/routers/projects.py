"""Project API router."""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.models import Project, ProjectCreate, ProjectUpdate, ProjectWithStats
from app.services.project_service import ProjectService

router = APIRouter()

# Service instance
service = ProjectService()


def success_response(data: Any = None, message: str = "Success") -> dict:
    """Create a success response."""
    return {"success": True, "message": message, "data": data}


def error_response(message: str) -> dict:
    """Create an error response."""
    return {"success": False, "message": message, "data": None}


@router.get("")
async def get_projects() -> dict:
    """Get all projects."""
    projects = service.get_all()
    return success_response([p.model_dump() for p in projects])


@router.get("/{project_id}")
async def get_project(project_id: int) -> dict:
    """Get project by ID."""
    project = service.get_with_stats(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return success_response(project.model_dump())


@router.post("")
async def create_project(project: ProjectCreate) -> dict:
    """Create a new project."""
    new_project = service.create(project)
    return success_response(new_project.model_dump(), "Project created successfully")


@router.put("/{project_id}")
async def update_project(project_id: int, project: ProjectUpdate) -> dict:
    """Update a project."""
    updated = service.update(project_id, project)
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found")
    return success_response(updated.model_dump(), "Project updated successfully")


@router.delete("/{project_id}")
async def delete_project(project_id: int) -> dict:
    """Delete a project."""
    if not service.delete(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return success_response(None, "Project deleted successfully")


@router.get("/{project_id}/tasks")
async def get_project_tasks(project_id: int) -> dict:
    """Get all tasks for a project."""
    from app.services.task_service import TaskService

    if not service.exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    task_service = TaskService()
    tasks = task_service.get_by_project(project_id)
    return success_response([t.model_dump() for t in tasks])


@router.get("/{project_id}/tasks/grouped")
async def get_project_tasks_grouped(project_id: int) -> dict:
    """Get tasks for a project grouped by status."""
    from app.services.task_service import TaskService

    if not service.exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    task_service = TaskService()
    grouped = task_service.get_by_project_grouped(project_id)
    return success_response(grouped.model_dump())
