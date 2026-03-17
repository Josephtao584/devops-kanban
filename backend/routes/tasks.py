from fastapi import APIRouter, Depends, HTTPException
from repositories.tasks import task_repo
from schemas.task import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskResponse
from utils.response import ApiResponse

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=ApiResponse)
async def get_tasks(project_id: int = None):
    """Get all tasks, optionally filtered by project"""
    if project_id:
        tasks = task_repo.get_by_project(project_id)
    else:
        tasks = task_repo.get_all()
    return ApiResponse.ok(data=tasks)


@router.get("/{task_id}", response_model=ApiResponse)
async def get_task(task_id: int):
    """Get a task by ID"""
    task = task_repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return ApiResponse.ok(data=task)


@router.post("", response_model=ApiResponse)
async def create_task(task_in: TaskCreate):
    """Create a new task"""
    task = task_repo.create(task_in.model_dump())
    return ApiResponse.ok(
        data=task, message="Task created"
    )


@router.put("/{task_id}", response_model=ApiResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
):
    """Update a task"""
    task = task_repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updated = task_repo.update(task_id, task_in.model_dump(exclude_unset=True))
    return ApiResponse.ok(
        data=updated, message="Task updated"
    )


@router.patch("/{task_id}/status", response_model=ApiResponse)
async def update_task_status(
    task_id: int,
    status_in: TaskStatusUpdate,
):
    """Update task status only"""
    task = task_repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updated = task_repo.update(task_id, {"status": status_in.status.value})
    return ApiResponse.ok(
        data=updated, message="Task status updated"
    )


@router.delete("/{task_id}", response_model=ApiResponse)
async def delete_task(task_id: int):
    """Delete a task"""
    task = task_repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task_repo.delete(task_id)
    return ApiResponse.ok(message="Task deleted")
