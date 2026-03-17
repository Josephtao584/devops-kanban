from storage import BaseFileRepository
from typing import Optional


class RequirementRepository(BaseFileRepository):
    """Requirement file repository"""

    def __init__(self):
        super().__init__("requirements.json")

    def get_all(self) -> list[dict]:
        return super().get_all()

    def get_by_id(self, id: int) -> Optional[dict]:
        return super().get_by_id(id)

    def get_by_project(self, project_id: int) -> list[dict]:
        """Get all requirements for a project"""
        return super().get_by_filter(project_id=project_id)

    def create(self, requirement: dict) -> dict:
        return super().create(requirement)

    def update(self, id: int, requirement: dict) -> Optional[dict]:
        return super().update(id, requirement)

    def delete(self, id: int) -> bool:
        return super().delete(id)


requirement_repo = RequirementRepository()
