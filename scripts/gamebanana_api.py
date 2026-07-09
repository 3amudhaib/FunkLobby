"""
GameBanana API wrapper for Friday Night Funkin' mod management.

Uses the Core API at https://api.gamebanana.com (the legacy v1 endpoint
at gamebanana.com/apiv1 is currently broken server-side).
Game ID for FNF: 8694
"""

import os
import time
import logging
from typing import Any
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)

GAME_ID_FNF = 8694
BASE_URL = "https://api.gamebanana.com/Core"


class GameBananaAPIError(Exception):
    pass


class GameBananaRateLimitError(GameBananaAPIError):
    pass


class GameBananaClient:
    def __init__(self, api_key: str | None = None, session_token: str | None = None):
        self.api_key = api_key or os.getenv("GAMEBANANA_API_KEY", "")
        self.session_token = session_token or os.getenv("GAMEBANANA_SESSION_TOKEN", "")
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Accept": "application/json",
        })
        self._last_request = 0.0
        self._min_interval = 0.5

    def _rate_limit(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request = time.time()

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any] | list[Any]:
        self._rate_limit()
        url = f"{BASE_URL}{path}"
        logger.debug("GET %s %s", url, params)
        resp = self._session.get(url, params=params, timeout=30)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "60"))
            logger.warning("Rate limited. Retrying in %ds", retry_after)
            time.sleep(retry_after)
            return self._get(path, params)
        if resp.status_code >= 400:
            msg = f"GameBanana API error {resp.status_code}: {resp.text[:200]}"
            if resp.status_code == 429:
                raise GameBananaRateLimitError(msg)
            raise GameBananaAPIError(msg)
        return resp.json()

    def list_mods(self, game_id: int = GAME_ID_FNF, page: int = 1) -> list[int]:
        data = self._get("/List/New", {
            "itemtype": "Mod",
            "gameid": str(game_id),
            "page": str(page),
            "format": "json_min",
        })
        if isinstance(data, list):
            return [entry[1] for entry in data if isinstance(entry, list) and len(entry) >= 2]
        return []

    def get_mod_info(self, mod_id: int) -> dict[str, Any]:
        fields = (
            "name,"
            "description,"
            "text,"
            "Owner().name,"
            "Category().name,"
            "Game().name,"
            "Preview().sStructuredDataFullsizeUrl(),"
            "Preview().sSubFeedImageUrl(),"
            "Url().sProfileUrl(),"
            "Url().sDownloadUrl(),"
            "Files().aFiles(),"
            "date,"
            "mdate,"
            "udate,"
            "downloads,"
            "views,"
            "Updates().aLatestUpdates(),"
            "Updates().bSubmissionHasUpdates()"
        )
        raw = self._get("/Item/Data", {
            "itemtype": "Mod",
            "itemid": str(mod_id),
            "fields": fields,
            "return_keys": "1",
            "format": "json_min",
        })
        if isinstance(raw, dict) and "error" in raw:
            raise GameBananaAPIError(f"Mod {mod_id}: {raw['error']}")
        if not isinstance(raw, dict):
            raise GameBananaAPIError(f"Unexpected response for mod {mod_id}")
        raw["_requested_id"] = str(mod_id)
        return self._normalize_mod(raw)

    def _normalize_mod(self, raw: dict[str, Any]) -> dict[str, Any]:
        files_raw = raw.get("Files().aFiles()", {}) or {}
        files = []
        for file_id, entry in files_raw.items():
            if isinstance(entry, dict):
                files.append({
                    "id": entry.get("_idRow", file_id),
                    "filename": entry.get("_sFile", ""),
                    "size_bytes": entry.get("_nFilesize", 0),
                    "download_url": entry.get("_sDownloadUrl", ""),
                    "date_added": self._unix_to_iso(entry.get("_tsDateAdded")),
                    "download_count": entry.get("_nDownloadCount", 0),
                    "md5": entry.get("_sMd5Checksum", ""),
                })

        updates_raw = raw.get("Updates().aLatestUpdates()", []) or []
        updates = []
        for entry in updates_raw:
            if isinstance(entry, dict):
                updates.append({
                    "text": entry.get("sText", ""),
                    "date": entry.get("tsDateAdded", ""),
                })

        return {
            "id": str(raw.get("_requested_id", raw.get("_idRow", raw.get("itemid", "0")))),
            "name": raw.get("name", ""),
            "description": raw.get("description", raw.get("text", "")),
            "text": raw.get("text", ""),
            "author": raw.get("Owner().name", ""),
            "category": raw.get("Category().name", ""),
            "game": raw.get("Game().name", ""),
            "preview_url": raw.get("Preview().sStructuredDataFullsizeUrl()", ""),
            "thumbnail_url": raw.get("Preview().sSubFeedImageUrl()", ""),
            "profile_url": raw.get("Url().sProfileUrl()", ""),
            "download_url": raw.get("Url().sDownloadUrl()", ""),
            "files": files,
            "date_created": self._unix_to_iso(raw.get("date")),
            "date_modified": self._unix_to_iso(raw.get("mdate")),
            "date_updated": self._unix_to_iso(raw.get("udate")),
            "downloads": raw.get("downloads", 0),
            "views": raw.get("views", 0),
            "has_updates": raw.get("Updates().bSubmissionHasUpdates()", False),
            "updates": updates,
            "version": self._guess_version(raw.get("name", ""), updates),
        }

    def _unix_to_iso(self, ts: int | str | None) -> str:
        if ts is None:
            return ""
        try:
            return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
        except (ValueError, TypeError, OSError):
            return str(ts)

    def _guess_version(self, name: str, updates: list[dict[str, Any]]) -> str:
        import re
        candidates = [name] + [u.get("text", "") for u in updates]
        for text in candidates:
            match = re.search(r"\b(\d+\.\d+(?:\.\d+)?)\b", text)
            if match:
                return f"v{match.group(1)}"
        return ""

    def submit_file(self, mod_id: int, filepath: str, notes: str = "") -> dict[str, Any]:
        if not self.session_token:
            raise GameBananaAPIError("Session token required for file uploads")
        self._rate_limit()
        url = f"https://api.gamebanana.com/Core/Item/File/Submit?itemtype=Mod&itemid={mod_id}"
        with open(filepath, "rb") as f:
            rfiles = {"file": (os.path.basename(filepath), f)}
            rdata = {"sNotes": notes}
            cookies = {"PHPSESSID": self.session_token}
            resp = self._session.post(url, data=rdata, files=rfiles, cookies=cookies, timeout=120)
        if resp.status_code >= 400:
            raise GameBananaAPIError(f"Upload failed: {resp.status_code} {resp.text[:200]}")
        return resp.json()

    def create_update_post(self, mod_id: int, text: str) -> dict[str, Any]:
        if not self.session_token:
            raise GameBananaAPIError("Session token required for update posts")
        self._rate_limit()
        url = f"https://api.gamebanana.com/Core/Item/Update/Submit?itemtype=Mod&itemid={mod_id}"
        cookies = {"PHPSESSID": self.session_token}
        resp = self._session.post(url, data={"sText": text}, cookies=cookies, timeout=30)
        if resp.status_code >= 400:
            raise GameBananaAPIError(f"Update post failed: {resp.status_code} {resp.text[:200]}")
        return resp.json()
