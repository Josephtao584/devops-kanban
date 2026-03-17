"""Task Source Adapter SPI - Abstract Base Class."""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any

from pydantic import BaseModel


class TaskSourceCapability(str, Enum):
    """Task source capabilities enumeration."""

    SYNC_ISSUES = "sync_issues"
    SYNC_PRS = "sync_prs"
    WEBHOOK_SUPPORT = "webhook"
    BATCH_IMPORT = "batch_import"


class TaskSourceMetadata(BaseModel):
    """Task source metadata for frontend dynamic rendering."""

    type: str
    name: str
    icon: str
    description: str
    capabilities: list[TaskSourceCapability]
    config_schema: dict
    auth_type: str  # "none", "token", "oauth", "basic"


class TaskSourceAdapter(ABC):
    """
    Task Source Adapter SPI - Abstract Base Class.

    Implement this interface to add new external task sources.
    The adapter is responsible for:
    1. Connecting to the external source
    2. Fetching issues/tasks
    3. Mapping to local Task model
    """

    def __init__(self, config: dict):
        """
        Initialize the adapter.

        Args:
            config: Source-specific configuration.
                   Example GitHub: {"repo": "owner/repo", "token": "ghp_xxx"}
                   Example Jira: {"board_id": "DEV", "jql": "project=DEV"}
        """
        self.config = config

    @classmethod
    @abstractmethod
    def get_metadata(cls) -> TaskSourceMetadata:
        """
        Return adapter metadata - used for frontend dynamic config UI.

        This is a class method because metadata doesn't depend on instance config.
        The returned JSON Schema can be used for:
        - Frontend dynamic form generation
        - Config validation
        """
        pass

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        """
        Test connection to the external source.

        Returns:
            (success, message): Test result and description
        """
        pass

    @abstractmethod
    async def fetch_items(self, sync_options: dict | None = None) -> list[dict]:
        """
        Fetch all items/issues from the external source.

        Args:
            sync_options: Optional sync options like:
                         - {"since": "2024-01-01"}  Incremental sync
                         - {"labels": ["bug"]}      Only sync specific labels
                         - {"limit": 100}           Limit count

        Returns:
            Raw item data list, structure defined by specific implementation
        """
        pass

    @abstractmethod
    def map_to_local_task(self, item: dict, project_id: int) -> "TaskCreate":
        """
        Map external item to local Task model.

        Args:
            item: External source raw data
            project_id: Local project ID to associate

        Returns:
            TaskCreate: Ready-to-create local task
        """
        pass

    @abstractmethod
    def get_source_type(self) -> str:
        """Return source type identifier, corresponding to TaskSourceType enum."""
        pass

    # ============ Optional methods ============

    def get_config_schema(self) -> dict:
        """
        Return config field JSON Schema.

        Default: get from metadata, subclasses can override for dynamic generation
        """
        return self.get_metadata().config_schema

    async def on_config_changed(self, new_config: dict) -> bool:
        """
        Callback when config changes (e.g., refresh OAuth token).

        Default: do nothing
        """
        return True


def register_adapter(source_type: str, adapter_cls: type[TaskSourceAdapter]):
    """
    Register a task source adapter.

    Usage (in adapter module):
        # github.py
        from app.adapters import register_adapter

        class GitHubAdapter(TaskSourceAdapter):
            ...

        register_adapter("GITHUB", GitHubAdapter)
    """
    from app.adapters import _ADAPTER_REGISTRY
    _ADAPTER_REGISTRY[source_type] = adapter_cls


def get_adapter(source_type: str, config: dict) -> TaskSourceAdapter:
    """
    Get adapter instance by source type.

    Args:
        source_type: Source type (e.g., "GITHUB", "JIRA")
        config: Adapter configuration

    Returns:
        Adapter instance

    Raises:
        ValueError: Unknown source type
    """
    from app.adapters import _ADAPTER_REGISTRY
    if source_type not in _ADAPTER_REGISTRY:
        available = ", ".join(_ADAPTER_REGISTRY.keys())
        raise ValueError(f"Unknown source type: {source_type}. Available: {available}")

    return _ADAPTER_REGISTRY[source_type](config)


def get_all_metadata() -> list[dict]:
    """
    Get metadata for all registered adapters.

    Returns:
        Metadata list for frontend display of available task source types
    """
    from app.adapters import _ADAPTER_REGISTRY
    return [
        adapter_cls.get_metadata().model_dump()
        for adapter_cls in _ADAPTER_REGISTRY.values()
    ]
