"""
GitHub API wrapper for release and tag management.

API docs: https://docs.github.com/en/rest/releases
"""

import os
import logging
from typing import Any
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://api.github.com"


class GitHubAPIError(Exception):
    pass


class GitHubRateLimitError(GitHubAPIError):
    pass


class GitHubClient:
    """Client for reading and creating GitHub releases."""

    def __init__(self, token: str | None = None):
        self.token = token or os.getenv("GITHUB_TOKEN", "")
        if not self.token:
            logger.warning("No GitHub token set — only unauthenticated requests (low rate limit)")
        self._session = requests.Session()
        self._session.headers.update({
            "Accept": "application/vnd.github+json",
            "User-Agent": "FNF-SyncTool/1.0",
        })
        if self.token:
            self._session.headers.update({"Authorization": f"Bearer {self.token}"})

    def _check_response(self, resp: requests.Response) -> dict[str, Any] | list[Any]:
        if resp.status_code == 401:
            raise GitHubAPIError("GitHub token is invalid or expired")
        if resp.status_code == 403:
            raise GitHubRateLimitError(
                f"GitHub rate limit hit. Reset at: {resp.headers.get('X-RateLimit-Reset', 'unknown')}"
            )
        if resp.status_code == 404:
            raise GitHubAPIError(f"Resource not found: {resp.url}")
        if resp.status_code >= 400:
            msg = f"GitHub API error {resp.status_code}: {resp.text[:200]}"
            raise GitHubAPIError(msg)
        return resp.json()

    def _get(self, path: str) -> dict[str, Any] | list[Any]:
        url = f"{BASE_URL}{path}"
        logger.debug("GET %s", url)
        resp = self._session.get(url, timeout=30)
        return self._check_response(resp)

    def _post(self, path: str, json_data: dict[str, Any]) -> dict[str, Any]:
        url = f"{BASE_URL}{path}"
        logger.debug("POST %s", url)
        resp = self._session.post(url, json=json_data, timeout=30)
        return self._check_response(resp)

    # ------------------------------------------------------------------
    # Repository helpers
    # ------------------------------------------------------------------

    def get_latest_release(self, owner: str, repo: str) -> dict[str, Any]:
        """
        Fetch the latest published release from a repository.

        GET /repos/{owner}/{repo}/releases/latest

        Returns dict with keys: tag_name, name, body, published_at, html_url, assets[]
        """
        return self._get(f"/repos/{owner}/{repo}/releases/latest")  # type: ignore[return-value]

    def get_release_by_tag(self, owner: str, repo: str, tag: str) -> dict[str, Any]:
        """
        Fetch a release by its tag name.

        GET /repos/{owner}/{repo}/releases/tags/{tag}
        """
        return self._get(f"/repos/{owner}/{repo}/releases/tags/{tag}")  # type: ignore[return-value]

    def list_tags(self, owner: str, repo: str) -> list[dict[str, Any]]:
        """
        List all tags in the repository.

        GET /repos/{owner}/{repo}/tags
        """
        return self._get(f"/repos/{owner}/{repo}/tags")  # type: ignore[list]

    def create_release(
        self,
        owner: str,
        repo: str,
        tag: str,
        title: str,
        body: str = "",
        draft: bool = False,
        prerelease: bool = False,
    ) -> dict[str, Any]:
        """
        Create a new release on GitHub.

        POST /repos/{owner}/{repo}/releases
        """
        payload = {
            "tag_name": tag,
            "name": title,
            "body": body,
            "draft": draft,
            "prerelease": prerelease,
        }
        return self._post(f"/repos/{owner}/{repo}/releases", payload)  # type: ignore[return-value]

    def upload_asset(self, release_id: int, owner: str, repo: str, filepath: str) -> dict[str, Any]:
        """
        Upload a file as an asset to an existing release.

        POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}
        """
        url = (
            f"{BASE_URL}/repos/{owner}/{repo}/releases/{release_id}/assets"
            f"?name={os.path.basename(filepath)}"
        )
        headers = self._session.headers.copy()
        headers["Content-Type"] = "application/octet-stream"
        with open(filepath, "rb") as f:
            resp = self._session.post(url, data=f, headers=headers, timeout=120)
        return self._check_response(resp)  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Comparison helpers
    # ------------------------------------------------------------------

    def get_tag_date(self, owner: str, repo: str, tag: str) -> datetime | None:
        """Get the commit date for a tag (requires fetching release metadata)."""
        try:
            release = self.get_release_by_tag(owner, repo, tag)
            published = release.get("published_at")
            if published:
                return datetime.fromisoformat(published.replace("Z", "+00:00"))
        except GitHubAPIError:
            pass
        return None

    @staticmethod
    def parse_version(tag: str) -> tuple[int, ...]:
        """Parse a semantic version from a git tag, e.g. 'v1.2.3' -> (1, 2, 3)."""
        cleaned = tag.lstrip("vV").strip()
        parts = cleaned.split(".")
        result: list[int] = []
        for part in parts:
            try:
                result.append(int(part))
            except ValueError:
                break
        return tuple(result)
