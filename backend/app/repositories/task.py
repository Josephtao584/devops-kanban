"""Task repository."""

from typing import Any

from app.models import Task, TaskStatus
from app.repositories.base import BaseRepository


class TaskRepository(BaseRepository[Task]):
    """Repository for Task entities."""

    def __init__(self):
        super().__init__(Task, "tasks.json")

    def find_by_project(self, project_id: int) -> list[Task]:
        """Find all tasks for a project."""
        data = self._load_all()
        return [
            Task(**item)
            for item in data
            if item.get("project_id") == project_id
        ]

    def find_by_project_and_status(
        self, project_id: int, status: TaskStatus
    ) -> list[Task]:
        """Find tasks by project and status."""
        data = self._load_all()
        return [
            Task(**item)
            for item in data
            if item.get("project_id") == project_id and item.get("status") == status.value
        ]

    def count_by_project(self, project_id: int) -> dict[str, int]:
        """Count tasks by project grouped by status."""
        tasks = self.find_by_project(project_id)
        counts: dict[str, int] = {status.value: 0 for status in TaskStatus}
        for task in tasks:
            counts[task.status.value] += 1
        return counts

    def delete_by_project(self, project_id: int) -> int:
        """Delete all tasks for a project."""
        data = self._load_all()
        initial_length = len(data)
        data = [item for item in data if item.get("project_id") != project_id]
        self._save_all(data)
        return initial_length - len(data)

    def find_by_status(self, status: TaskStatus) -> list[Task]:
        """Find all tasks with a specific status."""
        data = self._load_all()
        return [
            Task(**item)
            for item in data
            if item.get("status") == status.value
        ]

    def group_by_status(self, project_id: int) -> dict[str, list[Task]]:
        """Group tasks by status for a project."""
        tasks = self.find_by_project(project_id)
        grouped: dict[str, list[Task]] = {
            status.value: [] for status in TaskStatus
        }
        for task in tasks:
            grouped[task.status.value].append(task)
        return grouped
