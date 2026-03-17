"""Pytest configuration."""

import os
import sys
from pathlib import Path

import pytest

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Use test data directory
os.environ["STORAGE_PATH"] = str(backend_dir / "data")


@pytest.fixture
def client():
    """Create test client."""
    from fastapi.testclient import TestClient
    from app.main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_data():
    """Clean data before each test."""
    from app.config import STORAGE_PATH

    # Clean up before test
    for file in STORAGE_PATH.glob("*.json"):
        file.unlink()

    yield

    # Clean up after test
    for file in STORAGE_PATH.glob("*.json"):
        file.unlink()
