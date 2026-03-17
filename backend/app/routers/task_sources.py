"""Task Source API endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.models.task_source import TaskSourceCreate, TaskSourceUpdate
from app.services.task_source_service import TaskSourceService
from app.services.sync_service import SyncService

router = APIRouter()

source_service = TaskSourceService()
sync_service = SyncService()


def success_response(data: Any = None, message: str = "Success") -> dict:
    """Create a success response."""
    return {"success": True, "message": message, "data": data}


# ============ Task Source CRUD ============

@router.get("")
async def get_task_sources(project_id: int = Query(...)) -> dict:
    """Get all task sources for a project."""
    sources = source_service.get_by_project(project_id)
    return success_response([s.model_dump() for s in sources])


@router.get("/{source_id}")
async def get_task_source(source_id: int) -> dict:
    """Get task source details."""
    source = source_service.get_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Task source not found")
    return success_response(source.model_dump())


@router.post("")
async def create_task_source(source: TaskSourceCreate) -> dict:
    """Create a new task source."""
    new_source = source_service.create(source)
    return success_response(new_source.model_dump(), "Task source created")


@router.put("/{source_id}")
async def update_task_source(source_id: int, source: TaskSourceUpdate) -> dict:
    """Update a task source."""
    updated = source_service.update(source_id, source)
    if not updated:
        raise HTTPException(status_code=404, detail="Task source not found")
    return success_response(updated.model_dump(), "Task source updated")


@router.delete("/{source_id}")
async def delete_task_source(source_id: int) -> dict:
    """Delete a task source."""
    if not source_service.delete(source_id):
        raise HTTPException(status_code=404, detail="Task source not found")
    return success_response(None, "Task source deleted")


# ============ Sync Operations ============

@router.post("/{source_id}/sync")
async def sync_task_source(
    source_id: int,
    options: dict | None = None
) -> dict:
    """
    Manually trigger synchronization.

    This endpoint:
    1. Fetches items from external source
    2. Creates new tasks / updates existing tasks
    3. Updates last_sync_at timestamp
    """
    created, updated, message = await sync_service.sync_source(source_id, options)
    return success_response(
        {"created": created, "updated": updated},
        message
    )


@router.get("/{source_id}/test")
async def test_task_source_connection(source_id: int) -> dict:
    """Test connection to external task source."""
    success, message = await sync_service.test_connection(source_id)
    if success:
        return success_response(True, message)
    else:
        return success_response(data=False, message=message)


# ============ Metadata ============

@router.get("/types/available")
async def get_available_source_types() -> dict:
    """
    Get all available task source types and their metadata.

    This data can be used by frontend to dynamically generate:
    - "Add task source" selection list
    - Configuration forms
    """
    types = sync_service.get_available_source_types()
    return success_response(types)
