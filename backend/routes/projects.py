from fastapi import APIRouter, Depends, HTTPException
from repositories.projects import project_repo
from schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from utils.response import ApiResponse

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=ApiResponse)
async def get_projects():
    """Get all projects"""
    projects = project_repo.get_all()
    return ApiResponse.ok(data=projects)


@router.get("/{project_id}", response_model=ApiResponse)
async def get_project(project_id: int):
    """Get a project by ID"""
    project = project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ApiResponse.ok(data=project)


@router.post("", response_model=ApiResponse)
async def create_project(project_in: ProjectCreate):
    """Create a new project"""
    project = project_repo.create(project_in.model_dump())
    return ApiResponse.ok(
        data=project, message="Project created"
    )


@router.put("/{project_id}", response_model=ApiResponse)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
):
    """Update a project"""
    existing = project_repo.get_by_id(project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
    updated = project_repo.update(project_id, project_in.model_dump(exclude_unset=True))
    return ApiResponse.ok(
        data=updated, message="Project updated"
    )


@router.delete("/{project_id}", response_model=ApiResponse)
async def delete_project(project_id: int):
    """Delete a project"""
    project = project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project_repo.delete(project_id)
    return ApiResponse.ok(message="Project deleted")
