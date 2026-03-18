"""Session repository for managing AI agent execution sessions."""

from typing import Optional

from app.models.session import Session, SessionCreate, SessionUpdate
from app.repositories.base import BaseRepository


class SessionRepository(BaseRepository[Session]):
    """Repository for session data with JSON file storage."""

    def __init__(self):
        super().__init__(Session, "sessions.json")

    def get_by_task(self, task_id: int) -> list[Session]:
        """Get all sessions for a task."""
        data = self._load_all()
        return [Session(**item) for item in data if item.get("task_id") == task_id]

    def get_active_by_task(self, task_id: int) -> Optional[Session]:
        """Get the active (running or idle) session for a task."""
        sessions = self.get_by_task(task_id)
        for session in sessions:
            if session.status in [SessionStatus.RUNNING, SessionStatus.IDLE]:
                return session
        return None

    def create(self, session: SessionCreate) -> Session:
        """Create a new session."""
        from datetime import datetime

        data = self._load_all()
        new_id = self._get_next_id(data)

        now = datetime.now().isoformat()
        session_dict = session.model_dump()
        session_dict["id"] = new_id
        session_dict["created_at"] = now
        session_dict["updated_at"] = now
        session_dict["output"] = ""

        data.append(session_dict)
        self._save_all(data)

        return Session(**session_dict)

    def update(self, session_id: int, session: SessionUpdate) -> Optional[Session]:
        """Update an existing session."""
        from datetime import datetime

        data = self._load_all()

        for i, item in enumerate(data):
            if item.get("id") == session_id:
                update_data = session.model_dump(exclude_unset=True)
                update_data["updated_at"] = datetime.now().isoformat()
                data[i].update(update_data)
                self._save_all(data)
                return Session(**data[i])

        return None


# Import SessionStatus for type hints
from app.models.session import SessionStatus  # noqa: E402

# Singleton instance
session_repo = SessionRepository()
