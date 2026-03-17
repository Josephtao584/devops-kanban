from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from config import settings
from routes.projects import router as projects_router
from routes.requirements import router as requirements_router
from routes.tasks import router as tasks_router
from routes.roles import router as roles_router
from routes.members import router as members_router
from routes.agents import router as agents_router
from routes.executions import router as executions_router
from app.routers import task_sources
from utils.response import ApiResponse

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    errors = []
    for error in exc.errors():
        field = ".".join(str(x) for x in error["loc"])
        errors.append(f"{field}: {error['msg']}")
    return JSONResponse(
        status_code=422,
        content=ApiResponse.fail(message="Validation error", error="; ".join(errors)).model_dump()
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse.fail(message=exc.detail).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    return JSONResponse(
        status_code=500,
        content=ApiResponse.fail(message="Internal server error", error=str(exc)).model_dump()
    )


# Include routers (routes already have /projects, /requirements, etc. prefixes)
# Final paths will be: /api/projects, /api/requirements, /api/tasks, /api/roles, /api/members, /api/agents, /api/executions
app.include_router(projects_router, prefix="/api")
app.include_router(requirements_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(roles_router, prefix="/api")
app.include_router(members_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(executions_router, prefix="/api")
app.include_router(task_sources.router, prefix="/api/task-sources")


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to DevOps Kanban API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
