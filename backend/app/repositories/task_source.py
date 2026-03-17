"""TaskSource repository."""

from typing import Any

from app.models import TaskSource
from app.repositories.base import BaseRepository


class TaskSourceRepository(BaseRepository[TaskSource]):
    """Repository for TaskSource entities."""

    def __init__(self):
        super().__init__(TaskSource, "task_sources.json")

    def find_by_project(self, project_id: int) -> list[TaskSource]:
        """Find all task sources for a project."""
        data = self._load_all()
        return [
            TaskSource(**item)
            for item in data
            if item.get("project_id") == project_id
        ]

    def count_by_project(self, project_id: int) -> int:
        """Count task sources for a project."""
        data = self._load_all()
        return len([item for item in data if item.get("project_id") == project_id])

    def delete_by_project(self, project_id: int) -> int:
        """Delete all task sources for a project."""
        data = self._load_all()
        initial_length = len(data)
        data = [item for item in data if item.get("project_id") != project_id]
        self._save_all(data)
        return initial_length - len(data)

    def mark_synced(self, source_id: int) -> bool:
        """Mark a task source as synced (update last_sync_at)."""
        from datetime import datetime

        data = self._load_all()
        for i, item in enumerate(data):
            if item.get("id") == source_id:
                data[i]["last_sync_at"] = datetime.now().isoformat()
                data[i]["updated_at"] = datetime.now().isoformat()
                self._save_all(data)
                return True
        return False
