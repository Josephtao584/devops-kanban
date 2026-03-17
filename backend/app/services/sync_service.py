"""Sync Service - Orchestrates task synchronization from external sources."""

from typing import Optional

from app.models import Task, TaskCreate, TaskUpdate
from app.models.task_source import TaskSource
from app.services.task_source_service import TaskSourceService
from app.services.task_service import TaskService
from app.adapters import get_adapter


class SyncService:
    """
    Task sync orchestration service - Generic logic.

    Responsibilities:
    1. Get adapter based on TaskSource type
    2. Call adapter to fetch external items
    3. Create/update local tasks
    4. Record sync status

    Completely decoupled from specific source types - all source-specific
    logic is in the adapters.
    """

    def __init__(self):
        self.source_service = TaskSourceService()
        self.task_service = TaskService()

    async def sync_source(
        self,
        source_id: int,
        sync_options: dict | None = None
    ) -> tuple[int, int, str]:
        """
        Synchronize a single task source.

        Args:
            source_id: Task source ID
            sync_options: Optional sync options (passed to adapter)

        Returns:
            (created_count, updated_count, status_message)
        """
        source = self.source_service.get_by_id(source_id)
        if not source:
            return 0, 0, "Source not found"

        if not source.enabled:
            return 0, 0, "Source is disabled"

        try:
            # Get adapter (factory pattern)
            adapter = get_adapter(source.type, source.config)

            # Fetch external items
            items = await adapter.fetch_items(sync_options)

            created = 0
            updated = 0

            for item in items:
                task_data = adapter.map_to_local_task(item, source.project_id)

                # Deduplication: find existing task
                existing = self._find_existing_task(
                    source.project_id,
                    adapter.get_source_type(),
                    item
                )

                if existing:
                    # Update existing task
                    update_data = TaskUpdate(
                        title=task_data.title,
                        description=task_data.description,
                        status=task_data.status,
                        priority=task_data.priority,
                        assignee=task_data.assignee,
                        tags=task_data.tags,
                    )
                    self.task_service.update(existing.id, update_data)
                    updated += 1
                else:
                    # Create new task
                    self.task_service.create(task_data)
                    created += 1

            # Update sync timestamp
            self.source_service.mark_synced(source_id)

            return created, updated, f"Synced {created} new, {updated} updated"

        except Exception as e:
            return 0, 0, f"Sync failed: {str(e)}"

    def _find_existing_task(
        self,
        project_id: int,
        source_type: str,
        item: dict
    ) -> Optional[Task]:
        """
        Find existing task (deduplication strategy).

        Strategy:
        1. Prefer external_id (if Task model supports it)
        2. Fall back to URL matching

        Since Task model doesn't have external_id field, we use URL matching
        by looking for the GitHub issue URL in the task description.
        """
        all_tasks = self.task_service.get_by_project(project_id)
        url = item.get("html_url", "")

        if url:
            for task in all_tasks:
                if url in task.description:
                    return task
        return None

    async def test_connection(self, source_id: int) -> tuple[bool, str]:
        """Test connection to external source."""
        source = self.source_service.get_by_id(source_id)
        if not source:
            return False, "Source not found"

        try:
            adapter = get_adapter(source.type, source.config)
            return await adapter.test_connection()
        except Exception as e:
            return False, f"Error: {str(e)}"

    def get_available_source_types(self) -> list[dict]:
        """Get all available task source types and their metadata."""
        from app.adapters import get_all_metadata
        return get_all_metadata()
