"""Task API tests."""

import pytest
from fastapi.testclient import TestClient


class TestTaskAPI:
    """Test task API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_project(self, client: TestClient):
        """Create a project for tests."""
        response = client.post(
            "/api/projects", json={"name": "Test Project"}
        )
        self.project_id = response.json()["data"]["id"]

    def test_create_task(self, client: TestClient):
        """Test creating a task."""
        response = client.post(
            "/api/tasks",
            json={
                "project_id": self.project_id,
                "title": "Test Task",
                "description": "A test task",
                "status": "TODO",
                "priority": "HIGH",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["title"] == "Test Task"
        assert data["data"]["status"] == "TODO"

    def test_create_task_invalid_project(self, client: TestClient):
        """Test creating a task with invalid project ID."""
        response = client.post(
            "/api/tasks",
            json={"project_id": 999, "title": "Test Task"},
        )
        assert response.status_code == 400

    def test_get_tasks(self, client: TestClient):
        """Test getting all tasks."""
        # Create a task first
        client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Task 1"},
        )

        response = client.get("/api/tasks")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1

    def test_get_task_by_id(self, client: TestClient):
        """Test getting a task by ID."""
        # Create a task first
        create_response = client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Test Task"},
        )
        task_id = create_response.json()["data"]["id"]

        response = client.get(f"/api/tasks/{task_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["title"] == "Test Task"

    def test_get_task_not_found(self, client: TestClient):
        """Test getting a non-existent task."""
        response = client.get("/api/tasks/999")
        assert response.status_code == 404

    def test_update_task(self, client: TestClient):
        """Test updating a task."""
        # Create a task first
        create_response = client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Test Task"},
        )
        task_id = create_response.json()["data"]["id"]

        response = client.put(
            f"/api/tasks/{task_id}",
            json={"title": "Updated Task"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["title"] == "Updated Task"

    def test_update_task_status(self, client: TestClient):
        """Test updating task status."""
        # Create a task first
        create_response = client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Test Task"},
        )
        task_id = create_response.json()["data"]["id"]

        response = client.patch(
            f"/api/tasks/{task_id}/status",
            json={"status": "IN_PROGRESS"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["status"] == "IN_PROGRESS"

    def test_delete_task(self, client: TestClient):
        """Test deleting a task."""
        # Create a task first
        create_response = client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Test Task"},
        )
        task_id = create_response.json()["data"]["id"]

        response = client.delete(f"/api/tasks/{task_id}")
        assert response.status_code == 200

        # Verify task is deleted
        get_response = client.get(f"/api/tasks/{task_id}")
        assert get_response.status_code == 404

    def test_get_project_tasks(self, client: TestClient):
        """Test getting tasks for a project."""
        # Create tasks
        client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Task 1"},
        )
        client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Task 2"},
        )

        response = client.get(f"/api/projects/{self.project_id}/tasks")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2

    def test_get_project_tasks_grouped(self, client: TestClient):
        """Test getting tasks grouped by status."""
        # Create tasks with different statuses
        client.post(
            "/api/tasks",
            json={
                "project_id": self.project_id,
                "title": "Task 1",
                "status": "TODO",
            },
        )
        create_response = client.post(
            "/api/tasks",
            json={
                "project_id": self.project_id,
                "title": "Task 2",
                "status": "TODO",
            },
        )
        task_id = create_response.json()["data"]["id"]
        client.patch(
            f"/api/tasks/{task_id}/status", json={"status": "IN_PROGRESS"}
        )

        response = client.get(f"/api/projects/{self.project_id}/tasks/grouped")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["TODO"]) == 1
        assert len(data["data"]["IN_PROGRESS"]) == 1

    def test_delete_project_deletes_tasks(self, client: TestClient):
        """Test that deleting a project also deletes its tasks."""
        # Create a task
        client.post(
            "/api/tasks",
            json={"project_id": self.project_id, "title": "Task 1"},
        )

        # Delete project
        client.delete(f"/api/projects/{self.project_id}")

        # Verify tasks are gone
        response = client.get(f"/api/projects/{self.project_id}/tasks")
        assert response.status_code == 404
