from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class MemberBase(BaseModel):
    """Base member schema"""
    project_id: int
    user_id: int
    name: str
    email: str
    role_id: int
    role_name: str
    department: str
    status: str = "ACTIVE"


class MemberCreate(MemberBase):
    """Schema for creating a member"""
    pass


class MemberUpdate(BaseModel):
    """Schema for updating a member"""
    name: Optional[str] = None
    email: Optional[str] = None
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None


class MemberResponse(MemberBase):
    """Schema for member response"""
    id: int
    avatar: Optional[str] = None
    joined_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
