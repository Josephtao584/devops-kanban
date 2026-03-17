"""GitHub Issues Adapter."""

import json
import urllib.request
import urllib.error
from typing import Any
from urllib.parse import urlencode

from app.models import TaskCreate, TaskStatus, Priority
from app.models.task_source import TaskSourceType
from app.adapters.base import (
    TaskSourceAdapter,
    TaskSourceMetadata,
    TaskSourceCapability,
    register_adapter,
)


class GitHubAdapter(TaskSourceAdapter):
    """
    GitHub Issues Adapter.

    Config format:
    {
        "repo": "owner/repo",           # Required: GitHub repository
        "token": "ghp_xxx",             # Optional: Personal access token
        "state": "open" | "closed" | "all"  # Default: "open"
    }
    """

    BASE_URL = "https://api.github.com"

    @classmethod
    def get_metadata(cls) -> TaskSourceMetadata:
        return TaskSourceMetadata(
            type="GITHUB",
            name="GitHub Issues",
            icon="github",
            description="从 GitHub Issues 同步任务",
            capabilities=[
                TaskSourceCapability.SYNC_ISSUES,
                TaskSourceCapability.BATCH_IMPORT,
            ],
            config_schema={
                "type": "object",
                "required": ["repo"],
                "properties": {
                    "repo": {
                        "type": "string",
                        "title": "仓库",
                        "description": "GitHub 仓库，格式：owner/repo",
                        "placeholder": "例如：anthropics/claude-code"
                    },
                    "token": {
                        "type": "string",
                        "title": "访问令牌",
                        "description": "GitHub Personal Access Token（可选，提高 API 速率限制）",
                        "sensitive": True,
                        "placeholder": "ghp_..."
                    },
                    "state": {
                        "type": "string",
                        "enum": ["open", "closed", "all"],
                        "title": "Issue 状态",
                        "default": "open"
                    }
                }
            },
            auth_type="token"
        )

    @property
    def source_type(self) -> str:
        return TaskSourceType.GITHUB.value

    def get_source_type(self) -> str:
        return self.source_type

    def _make_request(self, url: str, headers: dict | None = None) -> tuple[int, dict]:
        """
        Make HTTP request using urllib.

        Returns:
            (status_code, response_data)
        """
        req = urllib.request.Request(url, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                return response.status, data
        except urllib.error.HTTPError as e:
            return e.code, {}
        except urllib.error.URLError as e:
            raise Exception(f"Connection error: {str(e.reason)}")
        except Exception as e:
            raise Exception(f"Request failed: {str(e)}")

    async def test_connection(self) -> tuple[bool, str]:
        """Test connection to GitHub API."""
        repo = self.config.get("repo", "")
        token = self.config.get("token")

        if not repo:
            return False, "Repository is required"

        headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            headers["Authorization"] = f"token {token}"

        try:
            status, data = self._make_request(
                f"{self.BASE_URL}/repos/{repo}",
                headers=headers
            )
            if status == 200:
                return True, "Successfully connected to GitHub"
            elif status == 404:
                return False, f"Repository '{repo}' not found"
            elif status == 401:
                return False, "Invalid token"
            else:
                return False, f"GitHub API error: {status}"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    async def fetch_items(self, sync_options: dict | None = None) -> list[dict]:
        """
        Fetch issues from GitHub.

        Args:
            sync_options: Optional sync options:
                         - {"since": "2024-01-01"}  Incremental sync
                         - {"labels": ["bug"]}      Only sync specific labels
                         - {"limit": 100}           Limit count
        """
        repo = self.config.get("repo", "")
        token = self.config.get("token")
        state = self.config.get("state", "open")

        if not repo:
            raise ValueError("Repository is required")

        headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            headers["Authorization"] = f"token {token}"

        # Build query parameters
        params = {"state": state, "per_page": 100}

        if sync_options:
            if "since" in sync_options:
                params["since"] = sync_options["since"]
            if "labels" in sync_options and sync_options["labels"]:
                params["labels"] = ",".join(sync_options["labels"])

        query_string = urlencode(params)
        url = f"{self.BASE_URL}/repos/{repo}/issues?{query_string}"

        try:
            status, issues = self._make_request(url, headers=headers)
            if status != 200:
                raise Exception(f"GitHub API error: {status}")

            # Apply limit if specified
            if sync_options and "limit" in sync_options:
                issues = issues[: sync_options["limit"]]

            return issues
        except Exception as e:
            raise Exception(f"Failed to fetch issues: {str(e)}")

    def map_to_local_task(self, item: dict, project_id: int) -> TaskCreate:
        """
        Map GitHub issue to local Task model.

        Args:
            item: GitHub issue data
            project_id: Local project ID

        Returns:
            TaskCreate: Ready-to-create local task
        """
        # Map GitHub labels to tags
        tags = [label["name"] for label in item.get("labels", []) if isinstance(label, dict)]

        # Map assignee
        assignees = item.get("assignees", [])
        assignee = assignees[0]["login"] if assignees and isinstance(assignees[0], dict) else None

        # Determine priority based on labels
        priority = Priority.MEDIUM
        for tag in tags:
            if tag.lower() in ["bug", "critical", "urgent"]:
                priority = Priority.HIGH
                break
            elif tag.lower() in ["enhancement", "feature"]:
                priority = Priority.LOW

        # Map state to status
        state = item.get("state", "open")
        if state == "closed":
            status = TaskStatus.DONE
        else:
            status = TaskStatus.TODO

        # Build description with GitHub link
        description = item.get("body", "") or ""
        html_url = item.get("html_url", "")
        if html_url:
            if description:
                description += f"\n\n---\nGitHub Issue: {html_url}"
            else:
                description = f"GitHub Issue: {html_url}"

        # Truncate description if too long
        if len(description) > 2000:
            description = description[:1997] + "..."

        return TaskCreate(
            project_id=project_id,
            title=item.get("title", "Untitled Issue")[:200],
            description=description,
            status=status,
            priority=priority,
            assignee=assignee,
            tags=tags,
        )


# Register the adapter
register_adapter("GITHUB", GitHubAdapter)
