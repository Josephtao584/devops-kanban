from fastapi import APIRouter, Depends, HTTPException
from repositories.roles import role_repo
from schemas.role import RoleCreate, RoleUpdate, RoleResponse
from utils.response import ApiResponse

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=ApiResponse)
async def get_roles(project_id: int = None):
    """Get all roles, optionally filtered by project"""
    if project_id:
        roles = role_repo.get_by_project(project_id)
    else:
        roles = role_repo.get_all()
    return ApiResponse.ok(data=roles)


@router.get("/{role_id}", response_model=ApiResponse)
async def get_role(role_id: int):
    """Get a role by ID"""
    role = role_repo.get_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return ApiResponse.ok(data=role)


@router.post("", response_model=ApiResponse)
async def create_role(role_in: RoleCreate):
    """Create a new role"""
    role = role_repo.create(role_in.model_dump())
    return ApiResponse.ok(
        data=role, message="Role created"
    )


@router.put("/{role_id}", response_model=ApiResponse)
async def update_role(
    role_id: int,
    role_in: RoleUpdate,
):
    """Update a role"""
    role = role_repo.get_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    updated = role_repo.update(role_id, role_in.model_dump(exclude_unset=True))
    return ApiResponse.ok(
        data=updated, message="Role updated"
    )


@router.delete("/{role_id}", response_model=ApiResponse)
async def delete_role(role_id: int):
    """Delete a role"""
    role = role_repo.get_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role_repo.delete(role_id)
    return ApiResponse.ok(message="Role deleted")
