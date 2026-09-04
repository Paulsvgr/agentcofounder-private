#!/usr/bin/env python3
"""VERIFY-by-VERIFY error timeline autopsy and fix-cost-per-error analysis."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "artifacts" / "runs"
ANALYSIS = ROOT / "artifacts/analysis"
OUT = ROOT / "artifacts/forensic/error-timeline-autopsy-v1.json"

IMPORT_RE = re.compile(r"Failed to resolve import|Cannot find module", re.I)
GLOBAL_RE = re.compile(r"expect is not defined|ReferenceError.*is not defined", re.I)
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
SUITE_SUMMARY = re.compile(r"FAIL\s*(\d+)/(\d+)\s*tests\s*·\s*(\d+)\s*failed", re.I)
PASS_SUMMARY = re.compile(r"PASS\s*(\d+)/(\d+)\s*tests\s*·\s*0\s*failed|✅ PASS", re.I)
MULTIPLE_ELS = re.compile(r"multiple elements|Found multiple", re.I)


def classify_error(text: str) -> tuple[str, str]:
    if IMPORT_RE.search(text):
        return "INFRA", "import_resolve"
    if GLOBAL_RE.search(text):
        return "INFRA", "missing_global_setup"
    if "SyntaxError" in text or "Transform failed" in text or "TransformPluginContext" in text:
        return "INFRA", "syntax_transform"
    if re.search(r"FAIL\s*0/0|suite did not run", text, re.I):
        return "INFRA", "suite_load"
    if INFRA_RE.search(text):
        return "INFRA", "runtime_infra"
    if MULTIPLE_ELS.search(text):
        return "ASSERT", "rtl_duplicate_element"
    if "getByTestId" in text or "data-testid" in text.lower():
        return "ASSERT", "rtl_testid"
    if "getByRole" in text:
        return "ASSERT", "rtl_role"
    if "getByLabelText" in text or "aria-label" in text.lower():
        return "ASSERT", "rtl_label"
    if "getByText" in text:
        return "ASSERT", "rtl_text"
    if RTL_RE.search(text):
        return "ASSERT", "rtl_other"
    if ASSERT_RE.search(text):
        return "ASSERT", "assertion_other"
    if "FAIL" in text or "Error" in text:
        return "OTHER", "unparsed_fail"
    return "UNKNOWN", "unknown"


def parse_failure_signatures(text: str) -> list[str]:
    sigs: list[str] = []
    if not text:
        return sigs
    if PASS_SUMMARY.search(text) and "FAIL" not in text:
        return sigs
    blocks = re.split(r"\[\d+/\d+\]", text)
    for block in blocks[1:]:
        _, sig = classify_error(block)
        if sig != "unknown":
            sigs.append(sig)
    if not sigs and ("FAIL" in text or "Error" in text):
        _, sig = classify_error(text)
        sigs.append(sig)
    return sigs


def parse_suite_counts(text: str) -> dict:
    if not text:
        return {"passed": None, "total": None, "failed": None, "outcome": "unknown"}
    if re.search(r"FAIL\s*0/0|suite did not run", text, re.I):
        return {"passed": 0, "total": 0, "failed": 0, "outcome": "infra"}
    m = SUITE_SUMMARY.search(text)
    if m:
        passed, total, failed = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return {
            "passed": passed,
            "total": total,
            "failed": failed,
            "outcome": "pass" if failed == 0 and passed == total else "fail",
        }
    if PASS_SUMMARY.search(text):
        m2 = re.search(r"PASS\s*(\d+)/(\d+)", text)
        if m2:
            p, t = int(m2.group(1)), int(m2.group(2))
            return {"passed": p, "total": t, "failed": 0, "outcome": "pass"}
        return {"passed": None, "total": None, "failed": 0, "outcome": "pass"}
    if "FAIL" in text:
        return {"passed": None, "total": None, "failed": None, "outcome": "fail"}
    return {"passed": None, "total": None, "failed": None, "outcome": "unknown"}


def is_test_path(p: str) -> bool:
    p = p.split("\n")[0]
    return ".test." in p or p.endswith(".spec.ts") or p.endswith(".spec.tsx")


def load_ledger(run_id: str) -> dict:
    return json.loads((ANALYSIS / run_id / "ledger.json").read_text())


def load_trajectory(run_id: str) -> dict:
    return json.loads((ANALYSIS / run_id / "trajectory.v2.json").read_text())


def verify_output_by_call(run_id: str) -> dict[int, str]:
    ledger = load_ledger(run_id)
    verify_calls = [
        c["index"]
        for c in ledger["calls"]
        if any(t.get("name") == "verify" for t in c.get("tools", []))
    ]
    outputs: list[str] = []
    for line in (RUNS / run_id / "events.jsonl").read_text(encoding="utf-8", errors="replace").splitlines():
        if "tool_execution_end" not in line or "verify" not in line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") != "tool_execution_end" or event.get("toolName") != "verify":
            continue
        content = event.get("result", {}).get("content", [])
        outputs.append(content[0].get("text", "") if content else "")

    mapping: dict[int, str] = {}
    for idx, call_index in enumerate(verify_calls):
        if idx < len(outputs):
            mapping[call_index] = outputs[idx]
    return mapping


def files_at_call(ledger: dict, call_index: int) -> set[str]:
    files: set[str] = set()
    for call in ledger["calls"]:
        if call["index"] > call_index:
            break
        for tool in call.get("tools", []):
            if tool.get("name") not in ("write", "edit"):
                continue
            for p in tool.get("paths") or []:
                files.add(p.split("\n")[0])
    return files


def analyze_inter_verify_actions(
    ledger: dict, from_call: int, to_call: int | None
) -> dict:
    test_files_before = {p for p in files_at_call(ledger, from_call) if is_test_path(p)}
    actions = {
        "calls": 0,
        "weighted_cost": 0.0,
        "product_writes": 0,
        "test_writes": 0,
        "new_test_files": [],
        "debug_sidecar": False,
        "bash_test_commands": 0,
        "verify_calls": 0,
        "strategy": "minimal",
    }
    end = to_call if to_call is not None else max(c["index"] for c in ledger["calls"]) + 1

    for call in ledger["calls"]:
        idx = call["index"]
        if idx <= from_call or idx >= end:
            continue
        actions["calls"] += 1
        actions["weighted_cost"] += call.get("weighted_cost", 0)
        for tool in call.get("tools", []):
            name = tool.get("name")
            if name == "verify":
                actions["verify_calls"] += 1
            if name == "bash":
                detail = tool.get("detail") or ""
                if "vitest" in detail or "npm test" in detail or "npm run test" in detail:
                    actions["bash_test_commands"] += 1
                if "debug.test" in detail or ("/tmp/" in detail and ".test." in detail):
                    actions["debug_sidecar"] = True
            if name not in ("write", "edit"):
                continue
            for p in tool.get("paths") or []:
                p0 = p.split("\n")[0]
                if is_test_path(p0):
                    actions["test_writes"] += 1
                    if p0 not in test_files_before:
                        actions["new_test_files"].append(p0)
                        test_files_before.add(p0)
                    if "debug" in p0.lower():
                        actions["debug_sidecar"] = True
                elif p0.startswith("src/") or p0.endswith((".tsx", ".ts", ".css")):
                    actions["product_writes"] += 1

    if actions["debug_sidecar"]:
        actions["strategy"] = "debug_sidecar"
    elif actions["new_test_files"] and actions["test_writes"] >= 2:
        actions["strategy"] = "test_surface_growth"
    elif actions["test_writes"] or actions["product_writes"]:
        actions["strategy"] = "direct_repair"
    elif actions["verify_calls"] > 0:
        actions["strategy"] = "verify_only"
    return actions


@dataclass
class VerifyEvent:
    ordinal: int
    call_index: int
    canonical: bool
    outcome: str
    passed: int | None
    total: int | None
    failed: int | None
    error_signatures: list[str]
    dominant_error: str | None
    files_before: list[str]
    test_file_count: int
    src_file_count: int


@dataclass
class VerifyTransition:
    from_ordinal: int
    to_ordinal: int
    from_call: int
    to_call: int
    dominant_error: str | None
    post_strategy: str
    debug_sidecar: bool
    new_test_files: list[str]
    inter_calls: int
    inter_weighted: float
    failed_before: int | None
    failed_after: int | None
    converging: bool | None
    error_replaced: bool
    errors_before: list[str]
    errors_after: list[str]


@dataclass
class RunTimeline:
    run_id: str
    cohort: str
    weighted: float
    calls: int
    snowball: bool
    debug_sidecar: bool
    first_verify_class: str | None
    verify_events: list[VerifyEvent] = field(default_factory=list)
    transitions: list[VerifyTransition] = field(default_factory=list)
    failure_count_sequence: list[int | None] = field(default_factory=list)
    convergence_class: str = "unknown"


def build_run_timeline(run_id: str, cohort: str, meta: dict) -> RunTimeline | None:
    traj_path = ANALYSIS / run_id / "trajectory.v2.json"
    if not traj_path.exists():
        return None
    traj = load_trajectory(run_id)
    ledger = load_ledger(run_id)
    verify_texts = verify_output_by_call(run_id)

    weighted = float(traj.get("weighted_total") or meta.get("weighted", 0))
    calls = int(traj.get("model_calls") or meta.get("calls", 0))
    snowball = bool(meta.get("snowball", calls >= 25 or weighted >= 120_000))
    debug_sidecar = bool(traj.get("debug_test_files_created")) or bool(meta.get("debug_sidecar"))

    events: list[VerifyEvent] = []
    ordinal = 0
    for v in traj.get("verification_runs") or []:
        if not v.get("canonical"):
            continue
        call_index = v.get("call_index")
        if call_index is None:
            continue
        source = v.get("source") or "unknown"
        text = verify_texts.get(call_index, "") if source == "verify" else ""
        if not text:
            text = v.get("raw_summary") or ""
        counts = parse_suite_counts(text)
        sigs = parse_failure_signatures(text)
        if not sigs and v.get("canonical_outcome") in ("fail", "unknown"):
            _, sig = classify_error(text)
            if sig != "unknown":
                sigs = [sig]
        outcome = counts["outcome"]
        if v.get("canonical_outcome") == "pass":
            outcome = "pass"
        elif v.get("canonical_outcome") == "fail":
            outcome = "fail"
        elif outcome == "unknown" and sigs:
            outcome = "fail"
        elif v.get("sidecar") and not sigs:
            continue  # skip empty sidecar noise unless it has errors

        files = sorted(files_at_call(ledger, call_index))
        test_n = sum(1 for f in files if is_test_path(f))
        src_n = sum(1 for f in files if f.startswith("src/") and not is_test_path(f))

        ordinal += 1
        events.append(
            VerifyEvent(
                ordinal=ordinal,
                call_index=call_index,
                canonical=True,
                outcome=outcome,
                passed=counts["passed"] if counts["passed"] is not None else v.get("passed"),
                total=counts["total"] if counts["total"] is not None else v.get("total"),
                failed=counts["failed"],
                error_signatures=sigs,
                dominant_error=Counter(sigs).most_common(1)[0][0] if sigs else None,
                files_before=files,
                test_file_count=test_n,
                src_file_count=src_n,
            )
        )

    if not events:
        return None

    transitions: list[VerifyTransition] = []
    fail_seq = [e.failed for e in events if e.canonical or True]

    for i in range(len(events) - 1):
        cur, nxt = events[i], events[i + 1]
        actions = analyze_inter_verify_actions(ledger, cur.call_index, nxt.call_index)
        fb, fa = cur.failed, nxt.failed
        converging = None
        if fb is not None and fa is not None:
            converging = fa < fb
        elif cur.outcome == "pass":
            converging = True
        errors_before = cur.error_signatures
        errors_after = nxt.error_signatures
        error_replaced = bool(errors_before and errors_after and Counter(errors_before).most_common(1)[0][0] != Counter(errors_after).most_common(1)[0][0])

        transitions.append(
            VerifyTransition(
                from_ordinal=cur.ordinal,
                to_ordinal=nxt.ordinal,
                from_call=cur.call_index,
                to_call=nxt.call_index,
                dominant_error=cur.dominant_error,
                post_strategy=actions["strategy"],
                debug_sidecar=actions["debug_sidecar"],
                new_test_files=actions["new_test_files"],
                inter_calls=actions["calls"],
                inter_weighted=actions["weighted_cost"],
                failed_before=fb,
                failed_after=fa,
                converging=converging,
                error_replaced=error_replaced,
                errors_before=errors_before,
                errors_after=errors_after,
            )
        )

    # convergence class for run
    canon_fails = [e.failed for e in events if e.outcome != "pass" and e.canonical]
    if not canon_fails:
        conv = "clean_pass"
    elif len(canon_fails) >= 2 and all(
        canon_fails[i] is not None and canon_fails[i + 1] is not None and canon_fails[i + 1] < canon_fails[i]
        for i in range(len(canon_fails) - 1)
    ):
        conv = "monotone_converging"
    elif any(t.debug_sidecar for t in transitions):
        conv = "debug_escalation"
    elif len(canon_fails) >= 2 and canon_fails[-1] is not None and canon_fails[0] is not None and canon_fails[-1] >= canon_fails[0]:
        conv = "non_converging"
    else:
        conv = "mixed"

    return RunTimeline(
        run_id=run_id,
        cohort=cohort,
        weighted=weighted,
        calls=calls,
        snowball=snowball,
        debug_sidecar=debug_sidecar,
        first_verify_class=meta.get("first_verify_class"),
        verify_events=events,
        transitions=transitions,
        failure_count_sequence=fail_seq,
        convergence_class=conv,
    )


def load_corpus_meta() -> list[dict]:
    path = ROOT / "artifacts/forensic/first-verify-corpus-v1.json"
    if path.exists():
        return json.loads(path.read_text()).get("corpus", [])
    return []


def select_cohorts(corpus: list[dict]) -> dict[str, list[dict]]:
    success = [r for r in corpus if r.get("run_id")]
    snow = sorted([r for r in success if r.get("snowball")], key=lambda r: -r["weighted"])[:20]

    recover_pool = [
        r
        for r in success
        if not r.get("snowball")
        and r.get("first_verify_class") in ("ASSERT_FAIL", "INFRA_FAIL")
        and r["weighted"] < 120_000
        and r.get("fails_before_green", 99) <= 3
    ]
    recover = sorted(recover_pool, key=lambda r: r["weighted"])[:20]

    cheap_pass = sorted(
        [
            r
            for r in success
            if r.get("first_verify_class") == "PASS"
            and not r.get("snowball")
            and r["weighted"] < 70_000
        ],
        key=lambda r: r["weighted"],
    )[:15]

    return {"snowball_top20": snow, "fail_recover20": recover, "cheap_pass15": cheap_pass}


def error_fix_stats(timelines: list[RunTimeline]) -> dict:
    """Per error signature: fix cost and snowball association."""
    by_sig: dict[str, dict] = defaultdict(lambda: {
        "occurrences": 0,
        "runs": set(),
        "calls_to_resolve": [],
        "weighted_to_resolve": [],
        "resolved_in_1_transition": 0,
        "resolved_in_2_transitions": 0,
        "post_debug_sidecar": 0,
        "post_test_growth": 0,
        "post_direct_repair": 0,
        "converging_transitions": 0,
        "non_converging_transitions": 0,
        "snowball_runs": set(),
        "eventually_passed": 0,
    })

    for tl in timelines:
        seen_sigs: set[str] = set()
        for i, ev in enumerate(tl.verify_events):
            if ev.outcome == "pass" and not ev.error_signatures:
                continue
            for sig in set(ev.error_signatures) or ([ev.dominant_error] if ev.dominant_error else []):
                if not sig or sig == "unknown":
                    continue
                stats = by_sig[sig]
                stats["occurrences"] += 1
                stats["runs"].add(tl.run_id)
                if tl.snowball:
                    stats["snowball_runs"].add(tl.run_id)

                # resolution: first pass after this event
                resolved_at = None
                for j in range(i + 1, len(tl.verify_events)):
                    if tl.verify_events[j].outcome == "pass":
                        resolved_at = j
                        break
                if resolved_at is not None:
                    stats["eventually_passed"] += 1
                    delta_calls = tl.verify_events[resolved_at].call_index - ev.call_index
                    stats["calls_to_resolve"].append(delta_calls)
                    w = 0.0
                    for call in load_ledger(tl.run_id)["calls"]:
                        if ev.call_index < call["index"] <= tl.verify_events[resolved_at].call_index:
                            w += call.get("weighted_cost", 0)
                    stats["weighted_to_resolve"].append(w)
                    transitions_needed = resolved_at - i
                    if transitions_needed <= 1:
                        stats["resolved_in_1_transition"] += 1
                    if transitions_needed <= 2:
                        stats["resolved_in_2_transitions"] += 1

                if i < len(tl.transitions):
                    tr = tl.transitions[i]
                    if tr.converging:
                        stats["converging_transitions"] += 1
                    elif tr.converging is False:
                        stats["non_converging_transitions"] += 1
                    if tr.post_strategy == "debug_sidecar":
                        stats["post_debug_sidecar"] += 1
                    elif tr.post_strategy == "test_surface_growth":
                        stats["post_test_growth"] += 1
                    elif tr.post_strategy == "direct_repair":
                        stats["post_direct_repair"] += 1

                seen_sigs.add(sig)

    result = {}
    for sig, stats in sorted(by_sig.items(), key=lambda x: -len(x[1]["runs"])):
        n_runs = len(stats["runs"])
        n_occ = stats["occurrences"]
        result[sig] = {
            "runs_affected": n_runs,
            "occurrences": n_occ,
            "snowball_run_rate": round(len(stats["snowball_runs"]) / n_runs, 3) if n_runs else 0,
            "median_calls_to_resolve": round(median(stats["calls_to_resolve"])) if stats["calls_to_resolve"] else None,
            "median_weighted_to_resolve": round(median(stats["weighted_to_resolve"])) if stats["weighted_to_resolve"] else None,
            "pct_resolved_in_1_transition": round(100 * stats["resolved_in_1_transition"] / n_occ, 1) if n_occ else 0,
            "pct_resolved_in_2_transitions": round(100 * stats["resolved_in_2_transitions"] / n_occ, 1) if n_occ else 0,
            "pct_post_debug_sidecar": round(100 * stats["post_debug_sidecar"] / n_occ, 1) if n_occ else 0,
            "pct_post_direct_repair": round(100 * stats["post_direct_repair"] / n_occ, 1) if n_occ else 0,
            "pct_converging_next": round(
                100 * stats["converging_transitions"] / (stats["converging_transitions"] + stats["non_converging_transitions"]),
                1,
            )
            if (stats["converging_transitions"] + stats["non_converging_transitions"])
            else None,
            "fixability": _fixability_label(stats, n_runs),
        }
    return result


def _fixability_label(stats: dict, n_runs: int) -> str:
    snow = len(stats["snowball_runs"]) / n_runs if n_runs else 0
    one = stats["resolved_in_1_transition"] / stats["occurrences"] if stats["occurrences"] else 0
    conv = stats["converging_transitions"] / max(1, stats["converging_transitions"] + stats["non_converging_transitions"])
    if snow >= 0.6 and stats["post_debug_sidecar"] / max(1, stats["occurrences"]) > 0.2:
        return "snowball_prone"
    if one >= 0.5 and snow < 0.35:
        return "usually_quick"
    if conv >= 0.55 and snow < 0.5:
        return "recoverable"
    return "mixed"


def cohort_summary(timelines: list[RunTimeline]) -> dict:
    if not timelines:
        return {"n": 0}
    post_strategies = Counter(t.post_strategy for tl in timelines for t in tl.transitions)
    conv = Counter(tl.convergence_class for tl in timelines)
    return {
        "n": len(timelines),
        "median_weighted": round(median(tl.weighted for tl in timelines)),
        "median_calls": round(median(tl.calls for tl in timelines)),
        "median_verify_events": round(median(len(tl.verify_events) for tl in timelines)),
        "debug_sidecar_rate": round(sum(tl.debug_sidecar for tl in timelines) / len(timelines), 3),
        "convergence_classes": dict(conv),
        "post_strategies": dict(post_strategies),
    }


def main() -> None:
    corpus = load_corpus_meta()
    cohorts = select_cohorts(corpus)

    all_timelines: list[RunTimeline] = []
    by_cohort: dict[str, list] = {}

    for cohort_name, rows in cohorts.items():
        timelines = []
        for row in rows:
            tl = build_run_timeline(row["run_id"], cohort_name, row)
            if tl:
                timelines.append(tl)
                all_timelines.append(tl)
        by_cohort[cohort_name] = [asdict(tl) for tl in timelines]

    # Full corpus timelines for error stats
    full_timelines = []
    for row in corpus:
        tl = build_run_timeline(row["run_id"], "full_corpus", row)
        if tl:
            full_timelines.append(tl)

    error_stats = error_fix_stats(full_timelines)

    # Pattern: post-strategy by dominant error (full corpus transitions)
    error_to_strategy: dict[str, Counter] = defaultdict(Counter)
    for tl in full_timelines:
        for tr in tl.transitions:
            if tr.dominant_error:
                error_to_strategy[tr.dominant_error][tr.post_strategy] += 1

    strategy_by_error = {
        sig: dict(counter.most_common()) for sig, counter in sorted(error_to_strategy.items(), key=lambda x: -sum(x[1].values()))
    }

    # Non-converging examples
    bad_examples = []
    for tl in sorted(full_timelines, key=lambda t: -t.weighted):
        if tl.convergence_class not in ("non_converging", "debug_escalation"):
            continue
        seq = [
            {
                "ordinal": e.ordinal,
                "call": e.call_index,
                "failed": e.failed,
                "dominant": e.dominant_error,
                "test_files": e.test_file_count,
            }
            for e in tl.verify_events[:8]
        ]
        bad_examples.append({"run_id": tl.run_id, "weighted": tl.weighted, "sequence": seq, "class": tl.convergence_class})
        if len(bad_examples) >= 10:
            break

    output = {
        "schema": "agentcofounder.error_timeline_autopsy.v1",
        "generated": "2026-09-02",
        "cohort_selection": {k: [r["run_id"] for r in v] for k, v in cohorts.items()},
        "cohort_summaries": {name: cohort_summary([tl for tl in all_timelines if tl.cohort == name]) for name in cohorts},
        "error_fix_stats_full_corpus": error_stats,
        "post_strategy_by_dominant_error": strategy_by_error,
        "non_converging_examples": bad_examples,
        "cohorts": by_cohort,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, indent=2), encoding="utf-8")

    print(f"Wrote {OUT}")
    print("\nCohort summaries:")
    for name, s in output["cohort_summaries"].items():
        print(f"  {name}: n={s.get('n')} med_wt={s.get('median_weighted')} verify_ev={s.get('median_verify_events')} debug={s.get('debug_sidecar_rate')}")

    print("\nError fix stats (top by runs_affected):")
    for sig, st in sorted(error_stats.items(), key=lambda x: -x[1]["runs_affected"])[:14]:
        print(
            f"  {sig:22} runs={st['runs_affected']:3} 1-tr={st['pct_resolved_in_1_transition']:5.1f}% "
            f"conv={st['pct_converging_next']} snow={st['snowball_run_rate']:.0%} debug_after={st['pct_post_debug_sidecar']:.0f}% -> {st['fixability']}"
        )


if __name__ == "__main__":
    main()
