from storage import BaseFileRepository
from typing import Optional, List


class MemberRepository(BaseFileRepository):
    """Repository for member operations"""

    def __init__(self, data_dir: str = None):
        super().__init__("members.json", data_dir)

    def get_by_project(self, project_id: int) -> List[dict]:
        """Get all members for a project"""
        data = self._read_data()
        return [item for item in data if item.get('project_id') == project_id]

    def get_by_user(self, user_id: int) -> Optional[dict]:
        """Get member by user ID"""
        return self.get_by_id(user_id)

    def get_active_by_project(self, project_id: int) -> List[dict]:
        """Get active members for a project"""
        data = self._read_data()
        return [
            item for item in data
            if item.get('project_id') == project_id and item.get('status') == 'ACTIVE'
        ]


# Global repository instance
member_repo = MemberRepository()
