from fastapi import APIRouter, Depends, HTTPException
from repositories.members import member_repo
from schemas.member import MemberCreate, MemberUpdate, MemberResponse
from utils.response import ApiResponse

router = APIRouter(prefix="/members", tags=["Members"])


@router.get("", response_model=ApiResponse)
async def get_members(project_id: int = None):
    """Get all members, optionally filtered by project_id"""
    if project_id:
        members = member_repo.get_by_project(project_id)
    else:
        members = member_repo.get_all()
    return ApiResponse.ok(data=members)


@router.get("/{member_id}", response_model=ApiResponse)
async def get_member(member_id: int):
    """Get a member by ID"""
    member = member_repo.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return ApiResponse.ok(data=member)


@router.post("", response_model=ApiResponse)
async def create_member(member_in: MemberCreate):
    """Create a new member"""
    # Check if user is already in the project
    existing = member_repo.get_by_field("user_id", member_in.user_id)
    if existing and existing.get('project_id') == member_in.project_id:
        raise HTTPException(status_code=400, detail="User is already in this project")

    member = member_repo.create(member_in.model_dump())
    return ApiResponse.ok(
        data=member, message="Member created"
    )


@router.put("/{member_id}", response_model=ApiResponse)
async def update_member(
    member_id: int,
    member_in: MemberUpdate,
):
    """Update a member"""
    existing = member_repo.get_by_id(member_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    updated = member_repo.update(member_id, member_in.model_dump(exclude_unset=True))
    return ApiResponse.ok(
        data=updated, message="Member updated"
    )


@router.delete("/{member_id}", response_model=ApiResponse)
async def delete_member(member_id: int):
    """Delete a member"""
    member = member_repo.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member_repo.delete(member_id)
    return ApiResponse.ok(message="Member deleted")
