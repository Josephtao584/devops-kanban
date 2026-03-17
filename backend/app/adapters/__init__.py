"""Task Source Adapters - SPI Factory and Registry."""

from typing import Type

from app.adapters.base import TaskSourceAdapter

# Adapter registry - automatically discovers all registered adapters
_ADAPTER_REGISTRY: dict[str, Type[TaskSourceAdapter]] = {}


def register_adapter(source_type: str, adapter_cls: Type[TaskSourceAdapter]):
    """
    Register a task source adapter.

    Usage (in adapter module):
        # github.py
        from app.adapters import register_adapter

        class GitHubAdapter(TaskSourceAdapter):
            ...

        register_adapter("GITHUB", GitHubAdapter)
    """
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
    return [
        adapter_cls.get_metadata().model_dump()
        for adapter_cls in _ADAPTER_REGISTRY.values()
    ]


# Import all adapter modules to trigger registration
from . import github  # noqa
# from . import jira   # [Future]
# from . import gitlab # [Future]
# from . import linear # [Future]
