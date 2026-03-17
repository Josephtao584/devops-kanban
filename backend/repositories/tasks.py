from storage import BaseFileRepository
from typing import Optional


class TaskRepository(BaseFileRepository):
    """Task file repository"""

    def __init__(self):
        super().__init__("tasks.json")

    def get_all(self) -> list[dict]:
        return super().get_all()

    def get_by_id(self, id: int) -> Optional[dict]:
        return super().get_by_id(id)

    def get_by_project(self, project_id: int) -> list[dict]:
        """Get all tasks for a project"""
        return super().get_by_filter(project_id=project_id)

    def create(self, task: dict) -> dict:
        return super().create(task)

    def update(self, id: int, task: dict) -> Optional[dict]:
        return super().update(id, task)

    def delete(self, id: int) -> bool:
        return super().delete(id)


task_repo = TaskRepository()
