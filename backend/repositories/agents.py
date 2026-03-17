from storage import BaseFileRepository
from typing import Optional


class AgentRepository(BaseFileRepository):
    """Agent file repository"""

    def __init__(self):
        super().__init__("agents.json")

    def get_all(self) -> list[dict]:
        return super().get_all()

    def get_by_id(self, id: int) -> Optional[dict]:
        return super().get_by_id(id)

    def create(self, agent: dict) -> dict:
        return super().create(agent)

    def update(self, id: int, agent: dict) -> Optional[dict]:
        return super().update(id, agent)

    def delete(self, id: int) -> bool:
        return super().delete(id)


agent_repo = AgentRepository()
