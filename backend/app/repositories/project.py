"""Project repository."""

from app.models import Project
from app.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    """Repository for Project entities."""

    def __init__(self):
        super().__init__(Project, "projects.json")

    def find_by_name(self, name: str) -> Project | None:
        """Find project by name."""
        data = self._load_all()
        for item in data:
            if item.get("name") == name:
                return Project(**item)
        return None
