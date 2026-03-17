"""Application configuration."""

import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Storage path for JSON data files (located at project root)
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", BASE_DIR.parent / "data"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

# Server configuration
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8080"))

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
