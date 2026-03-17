"""TaskSource service."""

from app.models import TaskSource, TaskSourceCreate, TaskSourceUpdate
from app.repositories import TaskSourceRepository


class TaskSourceService:
    """Service for task source operations."""

    def __init__(self):
        self.source_repo = TaskSourceRepository()

    def get_all(self) -> list[TaskSource]:
        """Get all task sources."""
        return self.source_repo.find_all()

    def get_by_id(self, source_id: int) -> TaskSource | None:
        """Get task source by ID."""
        return self.source_repo.find_by_id(source_id)

    def get_by_project(self, project_id: int) -> list[TaskSource]:
        """Get all task sources for a project."""
        return self.source_repo.find_by_project(project_id)

    def create(self, source_data: TaskSourceCreate) -> TaskSource:
        """Create a new task source."""
        return self.source_repo.create(source_data)

    def update(self, source_id: int, source_data: TaskSourceUpdate) -> TaskSource | None:
        """Update a task source."""
        return self.source_repo.update(source_id, source_data)

    def delete(self, source_id: int) -> bool:
        """Delete a task source."""
        return self.source_repo.delete(source_id)

    def exists(self, source_id: int) -> bool:
        """Check if task source exists."""
        return self.source_repo.find_by_id(source_id) is not None

    def mark_synced(self, source_id: int) -> bool:
        """Mark a task source as synced."""
        return self.source_repo.mark_synced(source_id)

    def delete_by_project(self, project_id: int) -> int:
        """Delete all task sources for a project."""
        return self.source_repo.delete_by_project(project_id)
