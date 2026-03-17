"""Project API tests."""

import pytest
from fastapi.testclient import TestClient


class TestProjectAPI:
    """Test project API endpoints."""

    def test_create_project(self, client: TestClient):
        """Test creating a project."""
        response = client.post(
            "/api/projects",
            json={"name": "Test Project", "description": "A test project"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Test Project"
        assert data["data"]["id"] == 1

    def test_get_projects_empty(self, client: TestClient):
        """Test getting empty project list."""
        response = client.get("/api/projects")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"] == []

    def test_get_projects(self, client: TestClient):
        """Test getting project list."""
        # Create a project first
        client.post("/api/projects", json={"name": "Project 1"})

        response = client.get("/api/projects")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["name"] == "Project 1"

    def test_get_project_by_id(self, client: TestClient):
        """Test getting a project by ID."""
        # Create a project first
        create_response = client.post(
            "/api/projects", json={"name": "Test Project"}
        )
        project_id = create_response.json()["data"]["id"]

        response = client.get(f"/api/projects/{project_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "Test Project"

    def test_get_project_not_found(self, client: TestClient):
        """Test getting a non-existent project."""
        response = client.get("/api/projects/999")
        assert response.status_code == 404

    def test_update_project(self, client: TestClient):
        """Test updating a project."""
        # Create a project first
        create_response = client.post(
            "/api/projects", json={"name": "Test Project"}
        )
        project_id = create_response.json()["data"]["id"]

        response = client.put(
            f"/api/projects/{project_id}",
            json={"name": "Updated Project"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "Updated Project"

    def test_delete_project(self, client: TestClient):
        """Test deleting a project."""
        # Create a project first
        create_response = client.post(
            "/api/projects", json={"name": "Test Project"}
        )
        project_id = create_response.json()["data"]["id"]

        response = client.delete(f"/api/projects/{project_id}")
        assert response.status_code == 200

        # Verify project is deleted
        get_response = client.get(f"/api/projects/{project_id}")
        assert get_response.status_code == 404

    def test_delete_project_not_found(self, client: TestClient):
        """Test deleting a non-existent project."""
        response = client.delete("/api/projects/999")
        assert response.status_code == 404
