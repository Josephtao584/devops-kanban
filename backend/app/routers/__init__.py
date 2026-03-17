"""API routers."""

from app.routers.projects import router as project_router
from app.routers.tasks import router as task_router

__all__ = ["project_router", "task_router"]
