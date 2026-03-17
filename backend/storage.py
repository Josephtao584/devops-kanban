import json
import os
from pathlib import Path
from typing import TypeVar, Generic, Type, Optional, List
from datetime import datetime

T = TypeVar('T')


class BaseFileRepository(Generic[T]):
    """Base class for file-based repositories"""

    def __init__(self, filename: str, data_dir: str = None):
        # Use provided data_dir or default to project root data directory
        if data_dir:
            self.data_path = Path(data_dir)
        else:
            self.data_path = Path(__file__).parent.parent / "data"
        self.file_path = self.data_path / filename
        self._ensure_data_dir()
        self._ensure_file_exists()

    def _ensure_data_dir(self):
        """Ensure data directory exists"""
        self.data_path.mkdir(exist_ok=True)

    def _ensure_file_exists(self):
        """Ensure data file exists"""
        if not self.file_path.exists():
            self.file_path.write_text("[]")

    def _read_data(self) -> List[dict]:
        """Read all data from file"""
        try:
            content = self.file_path.read_text(encoding='utf-8')
            return json.loads(content) if content.strip() else []
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write_data(self, data: List[dict]):
        """Write all data to file"""
        self.file_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False, default=str),
            encoding='utf-8'
        )

    def get_all(self) -> List[dict]:
        """Get all records"""
        return self._read_data()

    def get_by_id(self, id: int) -> Optional[dict]:
        """Get record by ID"""
        data = self._read_data()
        for item in data:
            if item.get('id') == id:
                return item
        return None

    def get_by_field(self, field: str, value) -> Optional[dict]:
        """Get record by field value"""
        data = self._read_data()
        for item in data:
            if item.get(field) == value:
                return item
        return None

    def get_by_filter(self, **filters) -> List[dict]:
        """Get records by filters"""
        data = self._read_data()
        result = []
        for item in data:
            match = True
            for key, value in filters.items():
                if item.get(key) != value:
                    match = False
                    break
            if match:
                result.append(item)
        return result

    def create(self, data: dict) -> dict:
        """Create a new record"""
        all_data = self._read_data()

        # Auto-generate ID
        max_id = max((item.get('id', 0) for item in all_data), default=0)
        data['id'] = max_id + 1

        # Add timestamps if not present
        if 'created_at' not in data:
            data['created_at'] = datetime.utcnow().isoformat()
        if 'updated_at' not in data:
            data['updated_at'] = datetime.utcnow().isoformat()

        all_data.append(data)
        self._write_data(all_data)
        return data

    def update(self, id: int, data: dict) -> Optional[dict]:
        """Update a record"""
        all_data = self._read_data()

        for i, item in enumerate(all_data):
            if item.get('id') == id:
                # Update fields
                data['id'] = id  # Keep original ID
                if 'created_at' not in data:
                    data['created_at'] = item.get('created_at')
                data['updated_at'] = datetime.utcnow().isoformat()

                all_data[i] = data
                self._write_data(all_data)
                return data

        return None

    def delete(self, id: int) -> bool:
        """Delete a record"""
        all_data = self._read_data()

        original_len = len(all_data)
        all_data = [item for item in all_data if item.get('id') != id]

        if len(all_data) < original_len:
            self._write_data(all_data)
            return True
        return False

    def delete_by_filter(self, **filters) -> int:
        """Delete records by filters, returns count of deleted items"""
        all_data = self._read_data()

        def should_keep(item):
            for key, value in filters.items():
                if item.get(key) != value:
                    return True
            return False

        new_data = [item for item in all_data if should_keep(item)]
        deleted_count = len(all_data) - len(new_data)

        if deleted_count > 0:
            self._write_data(new_data)

        return deleted_count
