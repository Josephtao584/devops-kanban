from storage import BaseFileRepository
from typing import Optional, List


class ExecutionRepository(BaseFileRepository):
    """Execution file repository"""

    def __init__(self):
        super().__init__("executions.json")

    def get_all(self) -> list[dict]:
        return super().get_all()

    def get_by_id(self, id: int) -> Optional[dict]:
        return super().get_by_id(id)

    def get_by_task(self, task_id: int) -> list[dict]:
        """Get all executions for a task"""
        return super().get_by_filter(task_id=task_id)

    def get_by_agent(self, agent_id: int) -> list[dict]:
        """Get all executions for an agent"""
        return super().get_by_filter(agent_id=agent_id)

    def create(self, execution: dict) -> dict:
        return super().create(execution)

    def update(self, id: int, execution: dict) -> Optional[dict]:
        return super().update(id, execution)

    def delete(self, id: int) -> bool:
        return super().delete(id)


execution_repo = ExecutionRepository()
