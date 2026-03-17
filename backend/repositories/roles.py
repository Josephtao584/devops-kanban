from storage import BaseFileRepository
from typing import Optional


class RoleRepository(BaseFileRepository):
    """Role file repository"""

    def __init__(self):
        super().__init__("roles.json")

    def get_all(self) -> list[dict]:
        return super().get_all()

    def get_by_id(self, id: int) -> Optional[dict]:
        return super().get_by_id(id)

    def get_by_project(self, project_id: int) -> list[dict]:
        """Get all roles for a project"""
        return super().get_by_filter(project_id=project_id)

    def create(self, role: dict) -> dict:
        return super().create(role)

    def update(self, id: int, role: dict) -> Optional[dict]:
        return super().update(id, role)

    def delete(self, id: int) -> bool:
        return super().delete(id)


role_repo = RoleRepository()
