"""Base repository with JSON file storage."""

import json
from datetime import datetime
from pathlib import Path
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.config import STORAGE_PATH

T = TypeVar("T", bound=BaseModel)


class BaseRepository(Generic[T]):
    """Base repository with JSON file storage."""

    def __init__(self, model_class: type[T], filename: str):
        self.model_class = model_class
        self.filepath = STORAGE_PATH / filename
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        """Ensure the data file exists."""
        if not self.filepath.exists():
            self._save_all([])

    def _load_all(self) -> list[dict]:
        """Load all data from JSON file."""
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def _save_all(self, data: list[dict]) -> None:
        """Save all data to JSON file."""
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _get_next_id(self, data: list[dict]) -> int:
        """Get the next available ID."""
        if not data:
            return 1
        return max(item.get("id", 0) for item in data) + 1

    def find_all(self) -> list[T]:
        """Find all entities."""
        data = self._load_all()
        return [self.model_class(**item) for item in data]

    def find_by_id(self, entity_id: int) -> T | None:
        """Find entity by ID."""
        data = self._load_all()
        for item in data:
            if item.get("id") == entity_id:
                return self.model_class(**item)
        return None

    def create(self, entity_data: BaseModel) -> T:
        """Create a new entity."""
        data = self._load_all()
        new_id = self._get_next_id(data)

        now = datetime.now().isoformat()
        entity_dict = entity_data.model_dump()
        entity_dict["id"] = new_id
        entity_dict["created_at"] = now
        entity_dict["updated_at"] = now

        data.append(entity_dict)
        self._save_all(data)

        return self.model_class(**entity_dict)

    def update(self, entity_id: int, entity_data: BaseModel) -> T | None:
        """Update an existing entity."""
        data = self._load_all()

        for i, item in enumerate(data):
            if item.get("id") == entity_id:
                update_data = entity_data.model_dump(exclude_unset=True)
                update_data["updated_at"] = datetime.now().isoformat()
                data[i].update(update_data)
                self._save_all(data)
                return self.model_class(**data[i])

        return None

    def delete(self, entity_id: int) -> bool:
        """Delete an entity by ID."""
        data = self._load_all()
        initial_length = len(data)
        data = [item for item in data if item.get("id") != entity_id]

        if len(data) < initial_length:
            self._save_all(data)
            return True
        return False

    def count(self) -> int:
        """Count all entities."""
        return len(self._load_all())
