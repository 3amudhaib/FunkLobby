"""
Core sync logic: compares versions between GameBanana and GitHub
and performs bidirectional updates.
"""

import logging
import re
import os
from typing import Any

from gamebanana_api import GameBananaClient, GameBananaAPIError
from github_api import GitHubClient, GitHubAPIError

logger = logging.getLogger(__name__)


class SyncResult:
    """Holds the result of a sync operation."""

    def __init__(self) -> None:
        self.gamebanana_version: str = ""
        self.github_version: str = ""
        self.github_release_url: str = ""
        self.mod_name: str = ""
        self.actions_taken: list[str] = []
        self.errors: list[str] = []

    @property
    def synced(self) -> bool:
        return self.gamebanana_version == self.github_version

    def __str__(self) -> str:
        lines = [
            f"Mod: {self.mod_name}",
            f"  GameBanana version: {self.gamebanana_version or '(none)'}",
            f"  GitHub version:     {self.github_version or '(none)'}",
        ]
        if self.github_release_url:
            lines.append(f"  GitHub release:     {self.github_release_url}")
        if self.actions_taken:
            lines.append(f"  Actions taken: {', '.join(self.actions_taken)}")
        if self.errors:
            lines.append(f"  Errors: {', '.join(self.errors)}")
        return "\n".join(lines)


class ModSyncer:
    """
    Bidirectional mod version syncer between GameBanana and GitHub.

    Sync logic
    ----------
    1. Fetch mod info from GameBanana (version from latest update note).
    2. Fetch latest release tag from GitHub.
    3. Parse and compare both versions.
    4. If GitHub is ahead  ->  upload build to GameBanana + post update note.
    5. If GameBanana is ahead ->  create a new GitHub release (pull request).
    """

    def __init__(
        self,
        gamebanana: GameBananaClient,
        github: GitHubClient,
        github_owner: str,
        github_repo: str,
        gamebanana_mod_id: int,
        build_artifact_path: str | None = None,
    ):
        self.gb = gamebanana
        self.gh = github
        self.owner = github_owner
        self.repo = github_repo
        self.mod_id = gamebanana_mod_id
        self.build_path = build_artifact_path

    def _extract_version_from_text(self, text: str) -> str | None:
        """Try to extract a version number like 'v1.2.3' or '1.2.3' from text."""
        match = re.search(r"\bv?(\d+\.\d+(?:\.\d+)?)\b", text)
        return f"v{match.group(1)}" if match else None

    def _compare_versions(self, gb_ver: str, gh_ver: str) -> int:
        """
        Compare two version strings.
        Returns 1 if gb_ver > gh_ver, -1 if gb_ver < gh_ver, 0 if equal.
        """
        gb_tuple = GitHubClient.parse_version(gb_ver)
        gh_tuple = GitHubClient.parse_version(gh_ver)
        if gb_tuple > gh_tuple:
            return 1
        if gb_tuple < gh_tuple:
            return -1
        return 0

    def sync(self) -> SyncResult:
        result = SyncResult()

        try:
            mod_info = self.gb.get_mod_info(self.mod_id)
        except GameBananaAPIError as e:
            result.errors.append(f"Failed to fetch GameBanana mod: {e}")
            return result

        result.mod_name = mod_info["name"]
        result.gamebanana_version = mod_info.get("version", "")
        gb_download_url = mod_info.get("download_url", "")

        try:
            latest = self.gh.get_latest_release(self.owner, self.repo)
            result.github_version = latest.get("tag_name", "")
            result.github_release_url = latest.get("html_url", "")
        except GitHubAPIError as e:
            result.errors.append(f"Failed to fetch GitHub release: {e}")
            return result

        if result.synced:
            result.actions_taken.append("Already in sync")
            return result

        comparison = self._compare_versions(
            result.gamebanana_version, result.github_version
        )

        if comparison < 0:
            self._sync_github_to_gamebanana(result, gb_download_url)
        elif comparison > 0:
            self._sync_gamebanana_to_github(result)
        else:
            result.actions_taken.append("Already in sync")

        return result

    def _sync_github_to_gamebanana(
        self, result: SyncResult, _gb_download_url: str
    ) -> None:
        """
        GitHub has a newer version -> upload build to GameBanana.
        """
        version = result.github_version
        logger.info("GitHub ahead (%s): uploading to GameBanana", version)
        try:
            if self.build_path and os.path.isfile(self.build_path):
                release_notes = (
                    f"Version {version} synced from GitHub.\n"
                    f"Source: {result.github_release_url}"
                )
                self.gb.submit_file(self.mod_id, self.build_path, notes=release_notes)
                result.actions_taken.append(
                    f"Uploaded {self.build_path} to GameBanana (version {version})"
                )
            self.gb.create_update_post(
                self.mod_id, f"Release {version} — synced from GitHub"
            )
            result.actions_taken.append(
                f"Posted update note on GameBanana for {version}"
            )
        except GameBananaAPIError as e:
            result.errors.append(f"GameBanana upload failed: {e}")

    def _sync_gamebanana_to_github(self, result: SyncResult) -> None:
        """
        GameBanana has a newer version -> create a GitHub release draft.
        """
        version = result.gamebanana_version
        logger.info("GameBanana ahead (%s): creating GitHub release", version)
        try:
            release = self.gh.create_release(
                owner=self.owner,
                repo=self.repo,
                tag=version,
                title=version,
                body=f"Synced from GameBanana mod #{self.mod_id}\n{result.gamebanana_version}",
                draft=True,
            )
            release_url = release.get("html_url", "")
            result.actions_taken.append(
                f"Created draft GitHub release {version} — {release_url}"
            )
        except GitHubAPIError as e:
            result.errors.append(f"GitHub release creation failed: {e}")
