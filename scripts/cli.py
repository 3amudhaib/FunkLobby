#!/usr/bin/env python3
"""
CLI entry point for the FNF GameBanana ⇄ GitHub sync tool.

Usage
-----
    python scripts/cli.py sync --mod-id 12345 --owner MyUser --repo my-mod-repo

    # With build artifact to upload when GitHub is ahead:
    python scripts/cli.py sync --mod-id 12345 --owner MyUser --repo my-mod-repo \\
        --build-path ./build-v1.2.3.zip

    # Verbose logging:
    python scripts/cli.py sync --mod-id 12345 --owner MyUser --repo my-mod-repo -v
"""

import argparse
import logging
import sys
import os

from gamebanana_api import GameBananaClient
from github_api import GitHubClient
from syncer import ModSyncer


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="fnf-sync",
        description="Bidirectional version sync for FNF mods between GameBanana and GitHub",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")

    sub = parser.add_subparsers(dest="command", required=True)

    # ---- sync command -------------------------------------------------------
    sync_parser = sub.add_parser("sync", help="Run a sync cycle")
    sync_parser.add_argument("--mod-id", type=int, required=True, help="GameBanana Mod ID")
    sync_parser.add_argument("--owner", required=True, help="GitHub repository owner")
    sync_parser.add_argument("--repo", required=True, help="GitHub repository name")
    sync_parser.add_argument(
        "--build-path",
        default=None,
        help="Path to a build artifact to upload when GitHub is ahead",
    )

    # ---- check command ------------------------------------------------------
    check_parser = sub.add_parser("check", help="Check current versions without making changes")
    check_parser.add_argument("--mod-id", type=int, required=True, help="GameBanana Mod ID")
    check_parser.add_argument("--owner", required=True, help="GitHub repository owner")
    check_parser.add_argument("--repo", required=True, help="GitHub repository name")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s | %(name)s | %(message)s",
        stream=sys.stderr,
    )

    gb = GameBananaClient()
    gh = GitHubClient()

    if args.command == "sync" or args.command == "check":
        syncer = ModSyncer(
            gamebanana=gb,
            github=gh,
            github_owner=args.owner,
            github_repo=args.repo,
            gamebanana_mod_id=args.mod_id,
            build_artifact_path=args.build_path if args.command == "sync" else None,
        )

        if args.command == "check":
            syncer.build_path = None  # never upload in check mode

        result = syncer.sync()
        print(str(result))

        if result.errors:
            sys.exit(1)


if __name__ == "__main__":
    main()
