#!/usr/bin/env python3
"""Print frontend /runs/<uuid> links for harness run_id timestamps.

Looks up rows via GET /api/v1/runs/ (public read) and matches data.run_id.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API_BASE = os.environ.get(
    "HACKATHON_API_BASE", "https://admin.coretechs.se/hackathon"
).rstrip("/")
FRONTEND_BASE = os.environ.get(
    "FRONTEND_BASE", "https://agentcofounder-hackathon.vercel.app"
).rstrip("/")


def fetch_runs() -> list[dict]:
    req = urllib.request.Request(
        f"{API_BASE}/api/v1/runs/",
        headers={"Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for key in ("results", "data", "runs"):
            value = body.get(key)
            if isinstance(value, list):
                return value
    raise ValueError(f"Unexpected runs list shape from {API_BASE}/api/v1/runs/")


def harness_run_id(row: dict) -> str | None:
    data = row.get("data")
    if not isinstance(data, dict):
        return None
    run_id = data.get("run_id")
    if run_id:
        return str(run_id)
    export = data.get("export")
    if isinstance(export, dict):
        meta = export.get("meta")
        if isinstance(meta, dict) and meta.get("run_id"):
            return str(meta["run_id"])
    return None


def index_by_run_id(runs: list[dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in runs:
        run_id = harness_run_id(row)
        uuid = row.get("id")
        if run_id and uuid:
            out[run_id] = str(uuid)
    return out


def main(argv: list[str]) -> int:
    run_ids = [part.strip() for part in argv if part.strip()]
    if not run_ids:
        print("Usage: print-run-frontend-links.py <run_id> [run_id ...]", file=sys.stderr)
        return 2

    try:
        by_run_id = index_by_run_id(fetch_runs())
    except urllib.error.URLError as exc:
        print(f"Failed to fetch runs from {API_BASE}: {exc}", file=sys.stderr)
        return 1
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Failed to parse runs API response: {exc}", file=sys.stderr)
        return 1

    missing: list[str] = []
    print("")
    print("Frontend links:")
    for run_id in run_ids:
        uuid = by_run_id.get(run_id)
        if not uuid:
            missing.append(run_id)
            print(f"  {run_id}: (not found in API — seed may have failed or run_id mismatch)")
            continue
        print(f"  {run_id}")
        print(f"    {FRONTEND_BASE}/runs/{uuid}")

    if missing:
        print(
            f"\nwarning: {len(missing)} run_id(s) not found in API",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
