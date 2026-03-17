from .projects import router as projects_router
from .requirements import router as requirements_router
from .tasks import router as tasks_router
from .roles import router as roles_router

__all__ = [
    "projects_router",
    "requirements_router",
    "tasks_router",
    "roles_router",
]
