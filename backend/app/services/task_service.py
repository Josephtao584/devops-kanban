"""Task service."""

from app.models import Task, TaskCreate, TaskStatus, TaskStatusUpdate, TaskUpdate, TaskByStatus
from app.repositories import TaskRepository


class TaskService:
    """Service for task operations."""

    def __init__(self):
        self.task_repo = TaskRepository()

    def get_all(self) -> list[Task]:
        """Get all tasks."""
        return self.task_repo.find_all()

    def get_by_id(self, task_id: int) -> Task | None:
        """Get task by ID."""
        return self.task_repo.find_by_id(task_id)

    def get_by_project(self, project_id: int) -> list[Task]:
        """Get all tasks for a project."""
        return self.task_repo.find_by_project(project_id)

    def get_by_project_grouped(self, project_id: int) -> TaskByStatus:
        """Get tasks for a project grouped by status."""
        grouped = self.task_repo.group_by_status(project_id)
        return TaskByStatus(**{k: v for k, v in grouped.items()})

    def create(self, task_data: TaskCreate) -> Task:
        """Create a new task."""
        return self.task_repo.create(task_data)

    def update(self, task_id: int, task_data: TaskUpdate) -> Task | None:
        """Update a task."""
        return self.task_repo.update(task_id, task_data)

    def update_status(self, task_id: int, status_data: TaskStatusUpdate) -> Task | None:
        """Update task status."""
        task = self.task_repo.find_by_id(task_id)
        if not task:
            return None

        update_data = TaskUpdate(status=status_data.status)
        return self.task_repo.update(task_id, update_data)

    def delete(self, task_id: int) -> bool:
        """Delete a task."""
        return self.task_repo.delete(task_id)

    def exists(self, task_id: int) -> bool:
        """Check if task exists."""
        return self.task_repo.find_by_id(task_id) is not None
