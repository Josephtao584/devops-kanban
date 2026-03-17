import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""

    # Application
    app_name: str = "DevOps Kanban API"
    debug: bool = True

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: Optional[str] = None  # If not set, uses sqlite in data_path
    data_path: str = "./data"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure data directory exists
os.makedirs(settings.data_path, exist_ok=True)
