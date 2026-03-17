"""Project service."""

from app.models import Project, ProjectCreate, ProjectUpdate, ProjectWithStats
from app.repositories import ProjectRepository, TaskRepository


class ProjectService:
    """Service for project operations."""

    def __init__(self):
        self.project_repo = ProjectRepository()
        self.task_repo = TaskRepository()

    def get_all(self) -> list[Project]:
        """Get all projects."""
        return self.project_repo.find_all()

    def get_by_id(self, project_id: int) -> Project | None:
        """Get project by ID."""
        return self.project_repo.find_by_id(project_id)

    def get_with_stats(self, project_id: int) -> ProjectWithStats | None:
        """Get project with task statistics."""
        project = self.project_repo.find_by_id(project_id)
        if not project:
            return None

        counts = self.task_repo.count_by_project(project_id)

        return ProjectWithStats(
            **project.model_dump(),
            task_count=sum(counts.values()),
            todo_count=counts.get("TODO", 0),
            in_progress_count=counts.get("IN_PROGRESS", 0),
            done_count=counts.get("DONE", 0),
        )

    def create(self, project_data: ProjectCreate) -> Project:
        """Create a new project."""
        return self.project_repo.create(project_data)

    def update(self, project_id: int, project_data: ProjectUpdate) -> Project | None:
        """Update a project."""
        return self.project_repo.update(project_id, project_data)

    def delete(self, project_id: int) -> bool:
        """Delete a project and its tasks."""
        # Delete associated tasks first
        self.task_repo.delete_by_project(project_id)
        return self.project_repo.delete(project_id)

    def exists(self, project_id: int) -> bool:
        """Check if project exists."""
        return self.project_repo.find_by_id(project_id) is not None
