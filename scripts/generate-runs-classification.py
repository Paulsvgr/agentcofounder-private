#!/usr/bin/env python3
"""Generate artifacts/runs-classification.json for hackathon runs UI backfill."""

from __future__ import annotations

import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "runs-classification.json"

# User enrichment (overrides approach / rating / comment when set).
ENRICH: dict[str, dict] = {
    "2026-08-21T17-12-43-573Z": {
        "approach": "A-baseline-1",
        "rating": 9,
        "comment": "A baseline, zai glm-5.2, unchanged d0f0b49",
    },
    "2026-08-21T17-16-01-144Z": {
        "approach": "A-baseline-2",
        "rating": 9,
        "comment": "A baseline, zai glm-5.2, unchanged d0f0b49",
    },
    "2026-08-21T17-19-47-720Z": {
        "approach": "A-baseline-3",
        "rating": 9,
        "comment": "A baseline, zai glm-5.2, unchanged d0f0b49",
    },
    "2026-08-21T17-25-01-445Z": {
        "approach": "A-prompt-1",
        "rating": 9,
        "comment": "do-not-start-servers prompt (cost went up)",
    },
    "2026-08-21T17-29-18-522Z": {
        "approach": "A-prompt-2",
        "rating": 9,
        "comment": "do-not-start-servers prompt (cost went up)",
    },
    "2026-08-21T17-33-44-063Z": {
        "approach": "A-prompt-3",
        "rating": 9,
        "comment": "do-not-start-servers prompt (heaviest ~187k)",
    },
    "2026-08-21T17-41-28-455Z": {
        "approach": "A-autotest-1",
        "rating": 9,
        "comment": "auto-test hook; lucky low ~54k",
    },
    "2026-08-21T17-44-12-352Z": {
        "approach": "A-autotest-2",
        "rating": 9,
        "comment": "auto-test",
    },
    "2026-08-21T17-49-43-616Z": {
        "approach": "A-autotest-3",
        "rating": 9,
        "comment": "auto-test; snapshotted in saved-apps",
    },
    "2026-08-21T23-45-52-404Z": {
        "approach": "A-autoverify-owned-1",
        "rating": 9,
        "comment": "harness-owned soft; SUCCESS ~119k, 32 calls; model still self-tested (~10 turns); harness finalize only",
    },
    "2026-08-21T23-58-29-140Z": {
        "approach": "A-autoverify-owned-2",
        "rating": 9,
        "comment": "harness-owned soft; SUCCESS ~133k, 38 calls; stacked self-test + harness verify",
    },
    "2026-08-22T00-05-30-093Z": {
        "approach": "A-autoverify-owned-3",
        "rating": 9,
        "comment": "harness-owned soft; SUCCESS ~108k, 38 calls; cheapest owned arm but still above A baseline",
    },
    "2026-08-22T00-16-51-819Z": {
        "approach": "A-autoverify-supplement-1",
        "rating": 9,
        "comment": "supplement arm; SUCCESS ~182k, 48 calls; worst cost — model self-tested heavily + harness settle",
    },
    "2026-08-22T00-27-06-457Z": {
        "approach": "A-autoverify-supplement-2",
        "rating": 9,
        "comment": "supplement arm; SUCCESS ~157k, 44 calls; stopped cohort at 2 — same stacking pattern",
    },
    "2026-08-22T00-48-30-278Z": {
        "approach": "A-autoverify-owned-gated-1",
        "rating": 6,
        "comment": "harness-owned-gated; PARTIAL ~133k, 38 calls; 0 self-test bash but 3 harness repair injects → max_rounds abort",
    },
    "2026-08-22T01-09-13-552Z": {
        "approach": "A-raw-1",
        "rating": 9,
        "comment": "back to stock A on main d0f0b49; SUCCESS ~119k, 32 calls; snapshotted in saved-apps",
    },
    "2026-08-20T21-51-00-219Z": {
        "approach": "A-prime-zai",
        "rating": 9,
        "comment": "Best A′: SUCCESS ~85k, 16/16 tests, clean UI",
    },
    "2026-08-20T21-54-53-923Z": {
        "approach": "B-prime-zai",
        "rating": 9,
        "comment": "SUCCESS ~139k, 20/20, inline lend",
    },
    "2026-08-20T22-00-59-263Z": {
        "approach": "C-prime-zai-clean",
        "rating": 9,
        "comment": "SUCCESS ~255k; port kept free",
    },
    "2026-08-20T19-28-31-545Z": {
        "approach": "B-prime",
        "rating": 9,
        "comment": "Berget SUCCESS ~63k; product great",
    },
    "2026-08-20T19-13-05-181Z": {
        "approach": "A-prime",
        "rating": 6,
        "comment": "timed out in RTL loop; no report.partial",
    },
    "2026-08-19T23-33-32-518Z": {
        "approach": "run-d / D",
        "rating": 9,
        "comment": "harness timeout, product great (snapshotted)",
    },
    "2026-08-19T23-05-29-779Z": {
        "approach": "C-original",
        "rating": 6,
        "comment": "SUCCESS; localStorage issue noted",
    },
    "2026-08-19T21-36-13-008Z": {
        "approach": "A-original",
        "rating": 9,
        "comment": "early SUCCESS ~10 min",
    },
    "2026-08-20T20-54-36-625Z": {
        "approach": "C-prime-gpt41",
        "rating": 6,
        "comment": "works but bare UI; ~262k",
    },
    "2026-08-20T20-09-54-516Z": {
        "approach": "C-prime-openai",
        "rating": 9,
        "comment": "gpt-5.2 too strong vs GLM — don't rank",
    },
    "2026-08-20T21-41-20-112Z": {
        "approach": "C-prime-zai",
        "rating": 9,
        "comment": "failed only because :3000 opened mid-verify — don't rank",
    },
    "2026-08-20T19-53-20-342Z": {
        "approach": "C-prime abort",
        "rating": 2,
        "comment": "Pi API abort, 0 tokens — not a real attempt",
    },
    "2026-08-20T19-53-59-239Z": {
        "approach": "C-prime abort",
        "rating": 2,
        "comment": "Pi API abort, 0 tokens — not a real attempt",
    },
    "2026-08-20T20-50-03-927Z": {
        "approach": "C-prime-gpt41-attempt",
        "rating": 2,
        "comment": "aborted TPM / RTL thrash",
    },
    "2026-08-20T20-09-27-922Z": {
        "approach": "C-prime abort",
        "rating": 2,
        "comment": "Pi API abort, 0 tokens — not a real attempt",
    },
    # Experiment 1 — RTL cleanup (Phase F)
    "2026-08-22T11-17-34-089Z": {
        "approach": "rtl-control-1",
        "rating": 9,
        "comment": "Experiment 1 · rtl-control · rep 1 · snowball · ~69k",
    },
    "2026-08-22T11-20-53-365Z": {
        "approach": "rtl-control-2",
        "rating": 9,
        "comment": "Experiment 1 · rtl-control · rep 2 · snowball · ~76k",
    },
    "2026-08-22T11-24-02-704Z": {
        "approach": "rtl-control-3",
        "rating": 9,
        "comment": "Experiment 1 · rtl-control · rep 3 · snowball · ~96k",
    },
    "2026-08-22T11-28-00-137Z": {
        "approach": "rtl-control-4",
        "rating": 9,
        "comment": "Experiment 1 · rtl-control · rep 4 · snowball · ~157k",
    },
    "2026-08-22T11-33-28-491Z": {
        "approach": "rtl-control-5",
        "rating": 9,
        "comment": "Experiment 1 · rtl-control · rep 5 · snowball · ~144k",
    },
    "2026-08-22T11-39-27-224Z": {
        "approach": "rtl-cleanup-1",
        "rating": 9,
        "comment": "Experiment 1 · rtl-cleanup · rep 1 · snowball · ~101k",
    },
    "2026-08-22T11-43-19-823Z": {
        "approach": "rtl-cleanup-2",
        "rating": 9,
        "comment": "Experiment 1 · rtl-cleanup · rep 2 · snowball · ~181k",
    },
    "2026-08-22T11-49-46-658Z": {
        "approach": "rtl-cleanup-3",
        "rating": 9,
        "comment": "Experiment 1 · rtl-cleanup · rep 3 · snowball · ~179k",
    },
    "2026-08-22T11-56-19-753Z": {
        "approach": "rtl-cleanup-4",
        "rating": 9,
        "comment": "Experiment 1 · rtl-cleanup · rep 4 · snowball · ~96k",
    },
    "2026-08-22T12-00-02-941Z": {
        "approach": "rtl-cleanup-5",
        "rating": 9,
        "comment": "Experiment 1 · rtl-cleanup · rep 5 · snowball · ~183k",
    },
}

APPROACH_MAP: dict[str, tuple[str, str, int | None]] = {
    "A-baseline-1": ("A", "baseline", 1),
    "A-baseline-2": ("A", "baseline", 2),
    "A-baseline-3": ("A", "baseline", 3),
    "A-prompt-1": ("A", "no-dev-server-prompt", 1),
    "A-prompt-2": ("A", "no-dev-server-prompt", 2),
    "A-prompt-3": ("A", "no-dev-server-prompt", 3),
    "A-autotest-1": ("A", "auto-test", 1),
    "A-autotest-2": ("A", "auto-test", 2),
    "A-autotest-3": ("A", "auto-test", 3),
    "A-autoverify-owned-1": ("A", "autoverify-owned", 1),
    "A-autoverify-owned-2": ("A", "autoverify-owned", 2),
    "A-autoverify-owned-3": ("A", "autoverify-owned", 3),
    "A-autoverify-supplement-1": ("A", "autoverify-supplement", 1),
    "A-autoverify-supplement-2": ("A", "autoverify-supplement", 2),
    "A-autoverify-owned-gated-1": ("A", "autoverify-gated", 1),
    "A-raw-1": ("A", "baseline", 1),
    "A-original": ("A", "legacy", None),
    "A-prime": ("A-prime", "prime-comparison", 1),
    "A-prime-zai": ("A-prime", "prime-comparison", 1),
    "B-prime": ("B-prime", "prime-comparison", 1),
    "B-prime-zai": ("B-prime", "prime-comparison", 1),
    "C-original": ("C", "legacy", 1),
    "C-prime-openai": ("C-prime", "prime-comparison", 1),
    "C-prime-gpt41": ("C-prime", "prime-comparison", 1),
    "C-prime-gpt41-attempt": ("C-prime", "prime-comparison", 1),
    "C-prime-zai": ("C-prime", "prime-comparison", 1),
    "C-prime-zai-clean": ("C-prime", "prime-comparison", 1),
    "C-prime abort": ("C-prime", "legacy-smoke", None),
    "run-d / D": ("D", "legacy", 1),
    "run-d": ("D", "legacy", 1),
    "rtl-control-1": ("F", "exp1-rtl-control", 1),
    "rtl-control-2": ("F", "exp1-rtl-control", 2),
    "rtl-control-3": ("F", "exp1-rtl-control", 3),
    "rtl-control-4": ("F", "exp1-rtl-control", 4),
    "rtl-control-5": ("F", "exp1-rtl-control", 5),
    "rtl-cleanup-1": ("F", "exp1-rtl-cleanup", 1),
    "rtl-cleanup-2": ("F", "exp1-rtl-cleanup", 2),
    "rtl-cleanup-3": ("F", "exp1-rtl-cleanup", 3),
    "rtl-cleanup-4": ("F", "exp1-rtl-cleanup", 4),
    "rtl-cleanup-5": ("F", "exp1-rtl-cleanup", 5),
}

LEGACY_SMOKE_IDS = {
    "2026-08-18T21-06-12-451Z",
    "2026-08-18T21-07-03-106Z",
    "2026-08-18T21-09-25-539Z",
    "2026-08-18T21-59-11-832Z",
    "2026-08-18T22-08-41-490Z",
    "2026-08-18T22-11-14-578Z",
    "2026-08-19T13-29-23-872Z",
    "2026-08-19T14-41-47-743Z",
    "2026-08-19T22-06-24-214Z",
}

DONT_RANK_PHRASES = ("don't rank", "not a real attempt", "abort")


def load_exports() -> dict[str, dict]:
    by_id: dict[str, dict] = {}
    paths = list((ROOT / "artifacts/exports/batch").glob("*.json"))
    paths += list((ROOT / "artifacts/exports").glob("*.json"))
    for path in sorted(paths, key=lambda p: ("batch" in str(p), p.name)):
        if path.name == "manifest.json":
            continue
        data = json.loads(path.read_text())
        run_id = data.get("meta", {}).get("run_id") or path.stem
        by_id[run_id] = data

    for run_dir in sorted((ROOT / "artifacts/runs").iterdir()):
        if not run_dir.is_dir():
            continue
        run_id = run_dir.name
        if run_id in by_id:
            continue
        result_path = run_dir / "result.json"
        if not result_path.exists():
            continue
        result = json.loads(result_path.read_text())
        by_id[run_id] = {
            "meta": {"run_id": run_id},
            "harness": result,
            "efficiency": {
                "weighted_total": (
                    result.get("input_tokens", 0)
                    + result.get("output_tokens", 0) * 3
                    + result.get("cache_read_tokens", 0) * 0.1
                ),
            },
        }
    return by_id


def parse_run_index(approach: str) -> int | None:
    match = re.search(r"-(\d+)$", approach or "")
    return int(match.group(1)) if match else None


def weighted_total(export: dict) -> float | None:
    efficiency = export.get("efficiency", {})
    harness = export.get("harness", {})
    total = efficiency.get("weighted_total")
    if total is None and harness:
        total = (
            harness.get("input_tokens", 0)
            + harness.get("output_tokens", 0) * 3
            + harness.get("cache_read_tokens", 0) * 0.1
        )
    return total


def classify(run_id: str, export: dict) -> dict:
    meta = export.get("meta", {})
    harness = export.get("harness", {})
    enrich = ENRICH.get(run_id, {})

    approach = enrich.get("approach") or meta.get("approach") or "unknown"
    if approach == "base" and run_id == "2026-08-21T17-12-43-573Z":
        approach = "A-baseline-1"

    comment = enrich.get("comment", "")
    rating = enrich.get("rating")

    line, experiment, run_index = APPROACH_MAP.get(approach, (None, None, None))
    if run_index is None:
        run_index = parse_run_index(approach)

    branch = meta.get("git_branch")
    commit = meta.get("git_commit")
    status = harness.get("status", "unknown")
    weighted = weighted_total(export)

    exclude = any(phrase in comment.lower() for phrase in DONT_RANK_PHRASES)
    hide_smoke = False
    compare_rank = not exclude

    if run_id in LEGACY_SMOKE_IDS or (
        approach == "unknown" and weighted is not None and weighted < 20000 and status == "partial"
    ):
        line = line or "unknown"
        experiment = "legacy-smoke"
        hide_smoke = True
        exclude = True
        compare_rank = False

    if approach.startswith("A-autoverify") and "gated" in approach:
        experiment = "autoverify-gated"
    elif meta.get("git_branch") == "exp/auto-verify":
        if approach.startswith("A-autoverify-supplement"):
            experiment = "autoverify-supplement"
        elif approach.startswith("A-autoverify-owned"):
            experiment = "autoverify-owned"

    if run_id == "2026-08-22T01-09-13-552Z":
        line, experiment, run_index = "A", "baseline", 1
        approach = enrich.get("approach", "A-raw-1")

    if line is None:
        if approach.startswith("A-"):
            line = "A"
        elif approach.startswith("rtl-"):
            line = "F"
        elif "prime" in approach.lower():
            line = approach.split("-")[0] if "-" in approach else "unknown"
        elif approach == "run-d":
            line = "D"
        else:
            line = "unknown"

    if experiment is None:
        if branch == "main" or (commit and str(commit).startswith("d0f0b49")):
            experiment = "baseline"
        elif branch == "exp/auto-verify":
            experiment = "autoverify-unknown"
        elif approach == "unknown":
            experiment = "unknown"
        else:
            experiment = "legacy"

    exp_label = experiment.replace("-", " ")
    display_label = (
        f"{line} · {exp_label} · run {run_index}"
        if run_index is not None
        else f"{line} · {exp_label}"
    )

    return {
        "classification": {
            "line": line,
            "experiment": experiment,
            "run_index": run_index,
            "display_label": display_label,
            "legacy_approach": approach,
        },
        "human": {
            "app_rating": rating,
            "run_comment": comment or None,
        },
        "flags": {
            "exclude_from_ranking": exclude,
            "hide_early_smoke": hide_smoke,
            "include_in_efficiency_compare": compare_rank,
        },
        "source": {
            "git_branch": branch,
            "git_commit": commit,
            "provider": meta.get("provider"),
            "model": meta.get("model"),
            "harness_status": status,
            "weighted_total": round(weighted) if weighted is not None else None,
            "model_calls": harness.get("model_calls"),
        },
    }


def sync_manifest_copies(source: Path) -> None:
    """Copy harness manifest to GreenCastle when paths exist (one-way sync)."""
    targets = [
        os.environ.get("RUNS_APP_FRONTEND_MANIFEST"),
        os.environ.get("RUNS_APP_BACKEND_MANIFEST"),
        "/mnt/c/Users/gronb/Desktop/GreenCastle/react/agentcofounder-hackathon/public/runs-classification.json",
        "/mnt/c/Users/gronb/Desktop/GreenCastle/FullStack/CoreTechs Fullstack/webeditor/hackathon/data/runs-classification.json",
    ]
    seen: set[str] = set()
    for raw in targets:
        if not raw or raw in seen:
            continue
        seen.add(raw)
        dest = Path(raw)
        if dest.parent.is_dir():
            shutil.copy2(source, dest)
            print(f"Synced manifest → {dest}")


def main() -> None:
    exports = load_exports()
    manifest = {
        "schema": "agentcofounder.runs_classification.v1",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "description": "Canonical method labels for hackathon runs UI backfill. Overlay by run_id on ingest; wins over derived meta.approach.",
        "taxonomy": {
            "line": ["A", "A-prime", "B-prime", "C", "C-prime", "D", "F", "unknown"],
            "experiment": [
                "baseline",
                "no-dev-server-prompt",
                "auto-test",
                "autoverify-off",
                "autoverify-supplement",
                "autoverify-owned",
                "autoverify-gated",
                "prime-comparison",
                "exp1-rtl-control",
                "exp1-rtl-cleanup",
                "legacy",
                "legacy-smoke",
                "unknown",
            ],
        },
        "derivation_rules": [
            "If run_id exists in this manifest, use classification + human fields as canonical.",
            "Else derive experiment from meta.approach prefix: A-autoverify-owned* → autoverify-owned, A-autoverify-supplement* → autoverify-supplement, A-prompt* → no-dev-server-prompt, A-autotest* → auto-test, A-baseline* / A-raw* → baseline, rtl-control* → exp1-rtl-control, rtl-cleanup* → exp1-rtl-cleanup.",
            "Else if git_branch === exp/auto-verify, experiment = autoverify-unknown.",
            "Else if git_branch === main && git_commit starts with d0f0b49, line = A, experiment = baseline.",
            "Parse run_index from trailing -N on approach string when present.",
            "Set flags.exclude_from_ranking when comment contains 'don't rank' or 'not a real attempt', or experiment === legacy-smoke.",
        ],
        "runs": {run_id: classify(run_id, export) for run_id, export in sorted(exports.items())},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {OUT} ({len(manifest['runs'])} runs)")
    sync_manifest_copies(OUT)


if __name__ == "__main__":
    main()
