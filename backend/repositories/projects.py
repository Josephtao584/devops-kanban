from storage import BaseFileRepository
from datetime import datetime
from typing import Optional


class ProjectRepository(BaseFileRepository):
    """Project file repository"""

    def __init__(self):
        super().__init__("projects.json")

    def get_all(self) -> list[dict]:
        return super().get_all()

    def get_by_id(self, id: int) -> Optional[dict]:
        return super().get_by_id(id)

    def create(self, project: dict) -> dict:
        return super().create(project)

    def update(self, id: int, project: dict) -> Optional[dict]:
        return super().update(id, project)

    def delete(self, id: int) -> bool:
        return super().delete(id)


project_repo = ProjectRepository()
