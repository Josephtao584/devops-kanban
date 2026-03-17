from fastapi import APIRouter, Depends, HTTPException
from repositories.requirements import requirement_repo
from schemas.requirement import RequirementCreate, RequirementUpdate, RequirementResponse
from utils.response import ApiResponse

router = APIRouter(prefix="/requirements", tags=["Requirements"])


@router.get("", response_model=ApiResponse)
async def get_requirements(project_id: int = None):
    """Get all requirements, optionally filtered by project"""
    if project_id:
        requirements = requirement_repo.get_by_project(project_id)
    else:
        requirements = requirement_repo.get_all()
    return ApiResponse.ok(data=requirements)


@router.get("/{requirement_id}", response_model=ApiResponse)
async def get_requirement(requirement_id: int):
    """Get a requirement by ID"""
    requirement = requirement_repo.get_by_id(requirement_id)
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return ApiResponse.ok(data=requirement)


@router.post("", response_model=ApiResponse)
async def create_requirement(requirement_in: RequirementCreate):
    """Create a new requirement"""
    requirement = requirement_repo.create(requirement_in.model_dump())
    return ApiResponse.ok(
        data=requirement,
        message="Requirement created",
    )


@router.put("/{requirement_id}", response_model=ApiResponse)
async def update_requirement(
    requirement_id: int,
    requirement_in: RequirementUpdate,
):
    """Update a requirement"""
    requirement = requirement_repo.get_by_id(requirement_id)
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    updated = requirement_repo.update(
        requirement_id, requirement_in.model_dump(exclude_unset=True)
    )
    return ApiResponse.ok(
        data=updated, message="Requirement updated"
    )


@router.delete("/{requirement_id}", response_model=ApiResponse)
async def delete_requirement(requirement_id: int):
    """Delete a requirement"""
    requirement = requirement_repo.get_by_id(requirement_id)
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    requirement_repo.delete(requirement_id)
    return ApiResponse.ok(message="Requirement deleted")
