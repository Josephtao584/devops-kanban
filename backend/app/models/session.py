"""Session data model for AI agent execution."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    """Session status enumeration."""

    CREATED = "CREATED"
    RUNNING = "RUNNING"
    IDLE = "IDLE"
    STOPPED = "STOPPED"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class AgentType(str, Enum):
    """Agent type enumeration."""

    CLAUDE = "CLAUDE"
    CODEX = "CODEX"
    CURSOR = "CURSOR"
    CUSTOM = "CUSTOM"


class SessionBase(BaseModel):
    """Base session model."""

    task_id: int
    agent_id: int
    status: SessionStatus = Field(default=SessionStatus.CREATED)
    initial_prompt: str = Field(default="")
    branch: Optional[str] = None
    claude_session_id: Optional[str] = None
    worktree_path: Optional[str] = None


class SessionCreate(SessionBase):
    """Session creation model."""

    pass


class SessionUpdate(BaseModel):
    """Session update model."""

    status: Optional[SessionStatus] = None
    initial_prompt: Optional[str] = None
    branch: Optional[str] = None
    claude_session_id: Optional[str] = None
    worktree_path: Optional[str] = None
    output: Optional[str] = None


class Session(SessionBase):
    """Session model with ID and timestamps."""

    id: int
    output: Optional[str] = Field(default="")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
