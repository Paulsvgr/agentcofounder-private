#!/usr/bin/env python3
"""Correlate final app implementation fingerprints with VERIFY errors and run cost."""

from __future__ import annotations

import json
import re
import urllib.request
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "artifacts" / "runs"
ANALYSIS = ROOT / "artifacts" / "analysis"
OVERLAY = ROOT / "artifacts" / "runs-overlay.json"
OUT = ROOT / "artifacts" / "forensic" / "app-error-correlation-v1.json"

IDEA_SNIP = "borrowing books off my shelves"

INFRA_RE = re.compile(
    r"Failed to resolve import|Cannot find module|expect is not defined|"
    r"ReferenceError|SyntaxError|Transform failed|Parse error|"
    r"FAIL\s*0/0|suite did not run|SUITE_ERROR|esbuild",
    re.I,
)
RTL_RE = re.compile(
    r"TestingLibraryElementError|Unable to find an accessible element|"
    r"Unable to find an element|getByRole|getByLabelText|getByText|getByTestId",
    re.I,
)
ASSERT_RE = re.compile(r"AssertionError|Expected .* to|Received:|toHaveTextContent|toBeVisible", re.I)
IMPORT_RE = re.compile(r"Failed to resolve import|Cannot find module", re.I)
GLOBAL_RE = re.compile(r"expect is not defined|ReferenceError.*is not defined", re.I)


@dataclass
class AppFingerprint:
    run_id: str
    has_app: bool = False
    src_file_count: int = 0
    tsx_count: int = 0
    ts_count: int = 0
    test_file_count: int = 0
    test_loc: int = 0
    component_count: int = 0
    hook_file_count: int = 0
    lib_file_count: int = 0
    uses_local_storage: bool = False
    uses_session_storage: bool = False
    uses_custom_hook: bool = False
    uses_context: bool = False
    uses_reducer: bool = False
    uses_fetch: bool = False
    uses_modal: bool = False
    uses_form: bool = False
    uses_router: bool = False
    data_testid_count: int = 0
    aria_label_count: int = 0
    role_button_count: int = 0
    css_class_count: int = 0
    inline_style_count: int = 0
    app_loc: int = 0
    monolith_app_tsx: bool = False
    split_components: bool = False
    has_store_module: bool = False
    has_types_file: bool = False
    debug_test_file: bool = False
    unit_test_file: bool = False
    journey_test_only: bool = False


@dataclass
class RunRecord:
    run_id: str
    status: str
    experiment_id: str | None
    weighted: float
    calls: int
    snowball: bool
    debug_sidecar: bool
    first_verify_class: str | None
    app_rating: float | None
    fingerprint: AppFingerprint
    verify_fail_signatures: list[str] = field(default_factory=list)
    verify_fail_classes: list[str] = field(default_factory=list)
    canonical_verify_count: int = 0
    fails_before_green: int = 0


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def list_src_files(app_root: Path) -> list[Path]:
    src = app_root / "src"
    if not src.is_dir():
        return []
    return [p for p in src.rglob("*") if p.is_file()]


def fingerprint_app(run_id: str) -> AppFingerprint:
    fp = AppFingerprint(run_id=run_id)
    app_root = RUNS / run_id / "app"
    files = list_src_files(app_root)
    if not files:
        return fp

    fp.has_app = True
    fp.src_file_count = len(files)
    contents: dict[str, str] = {}
    for path in files:
        rel = path.relative_to(app_root).as_posix()
        text = read_text(path)
        contents[rel] = text
        loc = len(text.splitlines())
        if rel.endswith(".tsx"):
            fp.tsx_count += 1
        if rel.endswith(".ts") and not rel.endswith(".test.ts"):
            fp.ts_count += 1
        if ".test." in rel:
            fp.test_file_count += 1
            fp.test_loc += loc
            if "debug" in rel.lower():
                fp.debug_test_file = True
            if "App.test" not in rel and "app.test" not in rel.lower():
                fp.unit_test_file = True
        else:
            fp.app_loc += loc
            if "/components/" in rel or rel.startswith("src/components/"):
                fp.component_count += 1
            if "/hooks/" in rel or "/hook" in rel.lower():
                fp.hook_file_count += 1
            if "/lib/" in rel or "/store" in rel.lower() or "store." in rel.lower():
                fp.lib_file_count += 1
            if "types.ts" in rel or "/types/" in rel:
                fp.has_types_file = True
            if "store" in rel.lower() or "collection" in rel.lower():
                fp.has_store_module = True

    all_src = "\n".join(contents.values())
    fp.uses_local_storage = "localStorage" in all_src
    fp.uses_session_storage = "sessionStorage" in all_src
    fp.uses_custom_hook = bool(re.search(r"\buse[A-Z]\w+", all_src))
    fp.uses_context = "createContext" in all_src or "useContext" in all_src
    fp.uses_reducer = "useReducer" in all_src
    fp.uses_fetch = "fetch(" in all_src
    fp.uses_modal = bool(re.search(r"modal|dialog|Dialog", all_src, re.I))
    fp.uses_form = bool(re.search(r"<form|onSubmit|type=\"submit\"", all_src, re.I))
    fp.uses_router = bool(re.search(r"react-router|Router|Route", all_src))
    fp.data_testid_count = len(re.findall(r"data-testid=", all_src))
    fp.aria_label_count = len(re.findall(r"aria-label=", all_src))
    fp.role_button_count = len(re.findall(r"role=\"button\"|getByRole\([\"']button", all_src))
    fp.css_class_count = len(re.findall(r"className=", all_src))
    fp.inline_style_count = len(re.findall(r"style=\{", all_src))
    fp.monolith_app_tsx = fp.tsx_count <= 2 and fp.component_count == 0 and "src/App.tsx" in contents
    fp.split_components = fp.component_count >= 2
    fp.journey_test_only = fp.test_file_count == 1 and not fp.unit_test_file and not fp.debug_test_file

    return fp


def classify_error(text: str) -> tuple[str, str]:
    if not text:
        return "UNKNOWN", "empty"
    if IMPORT_RE.search(text):
        return "INFRA", "import_resolve"
    if GLOBAL_RE.search(text):
        return "INFRA", "missing_global_setup"
    if INFRA_RE.search(text):
        if "SyntaxError" in text or "Transform failed" in text:
            return "INFRA", "syntax_transform"
        if "FAIL 0/0" in text or "suite did not run" in text:
            return "INFRA", "suite_load"
        return "INFRA", "runtime_infra"
    if RTL_RE.search(text):
        if "getByTestId" in text or "data-testid" in text.lower():
            return "ASSERT", "rtl_testid"
        if "getByRole" in text or "role" in text.lower():
            return "ASSERT", "rtl_role"
        if "getByLabelText" in text or "aria-label" in text.lower():
            return "ASSERT", "rtl_label"
        if "getByText" in text or "text content" in text.lower():
            return "ASSERT", "rtl_text"
        return "ASSERT", "rtl_other"
    if ASSERT_RE.search(text):
        return "ASSERT", "assertion_other"
    if "FAIL" in text:
        return "OTHER", "unparsed_fail"
    return "UNKNOWN", "unknown"


def verify_outputs(run_id: str) -> list[str]:
    path = RUNS / run_id / "events.jsonl"
    if not path.exists():
        return []
    outputs: list[str] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if "verify" not in line or "tool_execution_end" not in line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") != "tool_execution_end":
            continue
        if event.get("toolName") != "verify":
            continue
        content = event.get("result", {}).get("content", [])
        outputs.append(content[0].get("text", "") if content else "")
    return outputs


def parse_failure_signatures(text: str) -> list[str]:
    """Extract per-failure signatures from structured verify output."""
    sigs: list[str] = []
    if not text or ("FAIL" not in text and "Error" not in text):
        return sigs
    if re.search(r"✅ PASS|PASS \d+/\d+ tests · 0 failed", text) and "FAIL" not in text:
        return sigs

    blocks = re.split(r"\[\d+/\d+\]", text)
    for block in blocks[1:]:
        cls, sig = classify_error(block)
        if cls != "UNKNOWN":
            sigs.append(sig)

    if not sigs:
        cls, sig = classify_error(text)
        if cls != "UNKNOWN" or "FAIL" in text:
            sigs.append(sig)
    return sigs


def load_trajectory(run_id: str) -> dict | None:
    path = ANALYSIS / run_id / "trajectory.v2.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def trajectory_fail_signatures(run_id: str) -> list[str]:
    path = ANALYSIS / run_id / "trajectory.v2.json"
    if not path.exists():
        return []
    traj = json.loads(path.read_text())
    sigs: list[str] = []
    for run in traj.get("verification_runs") or []:
        if not run.get("canonical"):
            continue
        if run.get("canonical_outcome") == "pass":
            continue
        summary = run.get("raw_summary") or ""
        if not summary:
            continue
        _, sig = classify_error(summary)
        sigs.append(sig)
    return sigs

    path = ANALYSIS / run_id / "trajectory.v2.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def load_first_verify_class(run_id: str) -> str | None:
    corpus_path = ROOT / "artifacts" / "forensic" / "first-verify-corpus-v1.json"
    if corpus_path.exists():
        data = json.loads(corpus_path.read_text())
        for row in data.get("corpus", []):
            if row.get("run_id") == run_id:
                return row.get("first_verify_class")
    return None


def load_overlay() -> dict[str, dict]:
    if not OVERLAY.exists():
        return {}
    data = json.loads(OVERLAY.read_text())
    return data.get("runs", {})


def build_records() -> list[RunRecord]:
    with urllib.request.urlopen("http://localhost:5174/api/runs?limit=500") as resp:
        api_runs = {r["run_id"]: r for r in json.load(resp)["runs"]}

    overlay = load_overlay()
    records: list[RunRecord] = []

    for run_id, meta in sorted(api_runs.items()):
        idea_path = RUNS / run_id / "idea.txt"
        if not idea_path.exists() or IDEA_SNIP not in idea_path.read_text():
            continue

        traj = load_trajectory(run_id)
        weighted = (traj or {}).get("weighted_total") or meta.get("weighted_cost") or 0
        calls = (traj or {}).get("model_calls") or meta.get("model_calls") or 0
        snowball = calls >= 25 or weighted >= 120_000
        debug_sidecar = bool((traj or {}).get("debug_test_files_created"))

        fp = fingerprint_app(run_id)
        if fp.debug_test_file:
            debug_sidecar = True

        fail_sigs: list[str] = []
        fail_classes: list[str] = []
        for text in verify_outputs(run_id):
            sigs = parse_failure_signatures(text)
            fail_sigs.extend(sigs)
            for sig in sigs:
                if sig.startswith("import") or sig.startswith("missing") or sig.startswith("syntax") or sig.startswith("suite") or sig.startswith("runtime"):
                    fail_classes.append("INFRA")
                elif sig.startswith("rtl") or sig.startswith("assertion"):
                    fail_classes.append("ASSERT")
                else:
                    fail_classes.append("OTHER")
        if not fail_sigs:
            fail_sigs = trajectory_fail_signatures(run_id)
            for sig in fail_sigs:
                if sig.startswith("import") or sig.startswith("missing") or sig.startswith("syntax") or sig.startswith("suite") or sig.startswith("runtime"):
                    fail_classes.append("INFRA")
                elif sig.startswith("rtl") or sig.startswith("assertion"):
                    fail_classes.append("ASSERT")
                else:
                    fail_classes.append("OTHER")

        human = (overlay.get(run_id) or {}).get("human") or {}
        rating = human.get("app_rating")
        if isinstance(rating, (int, float)):
            rating = float(rating)

        records.append(
            RunRecord(
                run_id=run_id,
                status=meta.get("status") or "unknown",
                experiment_id=meta.get("experiment_id"),
                weighted=float(weighted),
                calls=int(calls),
                snowball=snowball,
                debug_sidecar=debug_sidecar,
                first_verify_class=load_first_verify_class(run_id),
                app_rating=rating,
                fingerprint=fp,
                verify_fail_signatures=fail_sigs,
                verify_fail_classes=fail_classes,
                canonical_verify_count=int((traj or {}).get("canonical_verification_count") or 0),
                fails_before_green=int((traj or {}).get("verify_fail_before_first_canonical_green") or 0),
            )
        )

    return records


def median_or_zero(values: list[float]) -> float:
    return float(median(values)) if values else 0.0


def summarize_group(rows: list[RunRecord]) -> dict:
    if not rows:
        return {"n": 0}
    return {
        "n": len(rows),
        "median_weighted": round(median_or_zero([r.weighted for r in rows])),
        "median_calls": round(median_or_zero([r.calls for r in rows])),
        "snowball_rate": round(sum(r.snowball for r in rows) / len(rows), 3),
        "debug_sidecar_rate": round(sum(r.debug_sidecar for r in rows) / len(rows), 3),
        "median_verify_fails": round(median_or_zero([len(r.verify_fail_signatures) for r in rows]), 1),
        "median_canonical_verify": round(median_or_zero([r.canonical_verify_count for r in rows])),
    }


def correlate_feature(records: list[RunRecord], attr: str, true_label: str | None = None) -> dict:
    with_feat = [r for r in records if getattr(r.fingerprint, attr)]
    without = [r for r in records if not getattr(r.fingerprint, attr)]
    label = true_label or attr
    return {
        "feature": label,
        "with": summarize_group(with_feat),
        "without": summarize_group(without),
        "delta_median_weighted": round(
            median_or_zero([r.weighted for r in with_feat]) - median_or_zero([r.weighted for r in without])
        ),
    }


def error_fixability(records: list[RunRecord]) -> dict:
    """Per error signature: how expensive are runs that hit it."""
    by_sig: dict[str, list[RunRecord]] = defaultdict(list)
    for r in records:
        seen = set(r.verify_fail_signatures)
        for sig in seen:
            by_sig[sig].append(r)

    out = {}
    for sig, rows in sorted(by_sig.items(), key=lambda x: -len(x[1])):
        out[sig] = {
            **summarize_group(rows),
            "pct_of_runs": round(100 * len(rows) / len(records), 1),
        }
    return out


def main() -> None:
    records = build_records()
    success = [r for r in records if r.status == "success"]
    with_app = [r for r in success if r.fingerprint.has_app]

    features = [
        "uses_local_storage",
        "uses_session_storage",
        "uses_custom_hook",
        "uses_context",
        "uses_reducer",
        "uses_modal",
        "uses_form",
        "split_components",
        "monolith_app_tsx",
        "has_store_module",
        "has_types_file",
        "unit_test_file",
        "debug_test_file",
        "journey_test_only",
    ]

    feature_corr = [correlate_feature(with_app, f) for f in features]

    # Numeric thresholds
    numeric_corr = []
    for attr, threshold, label in [
        ("test_file_count", 2, "test_files>=2"),
        ("component_count", 3, "components>=3"),
        ("data_testid_count", 5, "data_testid>=5"),
        ("src_file_count", 10, "src_files>=10"),
    ]:
        with_high = [r for r in with_app if getattr(r.fingerprint, attr) >= threshold]
        with_low = [r for r in with_app if getattr(r.fingerprint, attr) < threshold]
        numeric_corr.append(
            {
                "feature": label,
                "with": summarize_group(with_high),
                "without": summarize_group(with_low),
                "delta_median_weighted": round(
                    median_or_zero([r.weighted for r in with_high])
                    - median_or_zero([r.weighted for r in with_low])
                ),
            }
        )

    sig_stats = error_fixability(success)

    # Easy vs hard error proxy: median cost when signature appears once vs many verify fails
    easy_hard = {}
    for sig, stats in sig_stats.items():
        if stats["n"] < 3:
            continue
        easy_hard[sig] = {
            **stats,
            "fixability": (
                "often_spiral"
                if stats["snowball_rate"] >= 0.5 and stats["median_weighted"] >= 120_000
                else "often_recoverable"
                if stats["median_weighted"] < 90_000 and stats["snowball_rate"] < 0.35
                else "mixed"
            ),
        }

    stuck = sorted(
        [r for r in success if r.snowball],
        key=lambda r: -r.weighted,
    )[:15]

    stuck_summary = []
    for r in stuck:
        stuck_summary.append(
            {
                "run_id": r.run_id,
                "weighted": round(r.weighted),
                "calls": r.calls,
                "debug_sidecar": r.debug_sidecar,
                "first_verify_class": r.first_verify_class,
                "app_rating": r.app_rating,
                "error_signatures": Counter(r.verify_fail_signatures).most_common(5),
                "fingerprint": {
                    k: v
                    for k, v in asdict(r.fingerprint).items()
                    if k
                    not in ("run_id", "has_app")
                    and v not in (0, False, "")
                },
            }
        )

    # Patterns: features enriched in snowball vs cheap
    cheap = [r for r in with_app if not r.snowball and r.weighted < 70_000]
    snow = [r for r in with_app if r.snowball]

    def feature_rate(group: list[RunRecord], attr: str) -> float:
        if not group:
            return 0.0
        return sum(getattr(r.fingerprint, attr) for r in group) / len(group)

    pattern_flags = []
    for f in features:
        cheap_r = feature_rate(cheap, f)
        snow_r = feature_rate(snow, f)
        if abs(snow_r - cheap_r) >= 0.15 and (cheap_r > 0.05 or snow_r > 0.05):
            pattern_flags.append(
                {
                    "feature": f,
                    "cheap_rate": round(cheap_r, 3),
                    "snowball_rate": round(snow_r, 3),
                    "delta": round(snow_r - cheap_r, 3),
                }
            )
    pattern_flags.sort(key=lambda x: -abs(x["delta"]))

    output = {
        "schema": "agentcofounder.app_error_correlation.v1",
        "generated": "2026-09-02",
        "corpus": {
            "book_lending_runs": len(records),
            "success_runs": len(success),
            "with_app_snapshot": len(with_app),
        },
        "cost_tiers": {
            "cheap_lt_70k": summarize_group(cheap),
            "snowball": summarize_group(snow),
        },
        "feature_correlations": sorted(feature_corr, key=lambda x: -abs(x["delta_median_weighted"])),
        "numeric_correlations": sorted(numeric_corr, key=lambda x: -abs(x["delta_median_weighted"])),
        "error_signature_stats": sig_stats,
        "error_fixability": easy_hard,
        "cheap_vs_snowball_feature_rates": pattern_flags,
        "top_stuck_runs": stuck_summary,
        "records": [asdict(r) for r in records],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, indent=2), encoding="utf-8")

    print(f"Wrote {OUT}")
    print(f"Success with app: {len(with_app)}")
    print("\nTop feature deltas (snowball-enriched):")
    for p in pattern_flags[:8]:
        print(f"  {p['feature']}: cheap={p['cheap_rate']:.0%} snow={p['snowball_rate']:.0%} delta={p['delta']:+.0%}")
    print("\nError fixability (n>=3):")
    for sig, s in sorted(easy_hard.items(), key=lambda x: -x[1]["median_weighted"])[:12]:
        print(
            f"  {sig}: n={s['n']} med={s['median_weighted']:,} snow={s['snowball_rate']:.0%} -> {s['fixability']}"
        )


if __name__ == "__main__":
    main()
