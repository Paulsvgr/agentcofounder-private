#!/usr/bin/env python3
"""Matched repair-strategy study: normalized error signatures, snowball vs recovery."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "artifacts/runs"
ANALYSIS = ROOT / "artifacts/analysis"
CORPUS_PATH = ROOT / "artifacts/forensic/first-verify-corpus-v1.json"
OUT = ROOT / "artifacts/forensic/matched-repair-strategy-v1.json"


def is_test_path(p: str) -> bool:
    p = p.split("\n")[0]
    return ".test." in p or p.endswith(".spec.ts") or p.endswith(".spec.tsx")


def load_ledger(run_id: str) -> dict:
    return json.loads((ANALYSIS / run_id / "ledger.json").read_text())


def load_trajectory(run_id: str) -> dict:
    return json.loads((ANALYSIS / run_id / "trajectory.v2.json").read_text())


def verify_texts_by_call(run_id: str) -> dict[int, str]:
    ledger = load_ledger(run_id)
    verify_calls = [
        c["index"]
        for c in ledger["calls"]
        if any(t.get("name") == "verify" for t in c.get("tools", []))
    ]
    outputs: list[str] = []
    events_path = RUNS / run_id / "events.jsonl"
    if events_path.exists():
        for line in events_path.read_text(encoding="utf-8", errors="replace").splitlines():
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

    return {call: outputs[i] for i, call in enumerate(verify_calls) if i < len(outputs)}


def canonical_verify_events(run_id: str) -> list[dict]:
    traj = load_trajectory(run_id)
    verify_map = verify_texts_by_call(run_id)
    events = []
    for v in traj.get("verification_runs") or []:
        if not v.get("canonical"):
            continue
        call = v["call_index"]
        text = verify_map.get(call, "") if v.get("source") == "verify" else ""
        if not text:
            text = v.get("raw_summary") or ""
        events.append(
            {
                "call_index": call,
                "source": v.get("source"),
                "text": text,
                "raw_summary": v.get("raw_summary") or "",
                "passed": v.get("passed"),
                "total": v.get("total"),
                "outcome": v.get("canonical_outcome"),
                "sidecar": v.get("sidecar"),
            }
        )
    return events


def _norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip())[:200]


def parse_structured_block(block: str) -> dict | None:
    """Parse one [n/m] failure block from harness verify output."""
    file_m = re.search(r"FAIL\s+(\S+\.(?:tsx?|jsx?))", block)
    test_m = re.search(r"TEST\s+(.+?)(?:\n|TYPE)", block, re.S)
    type_m = re.search(r"TYPE\s+(\S+)", block)
    at_m = re.search(r"AT\s+(\S+)", block)
    msg_m = re.search(r"MESSAGE\s*\n(.+?)(?:\n\n|\n\[|\Z)", block, re.S)

    file_path = file_m.group(1) if file_m else (at_m.group(1) if at_m else "")
    test_name = _norm_ws(test_m.group(1)) if test_m else ""
    err_type = type_m.group(1) if type_m else ""
    message = _norm_ws(msg_m.group(1)) if msg_m else _norm_ws(block)

    return {
        "file": file_path.split("/")[-1] if file_path else "",
        "test_name": test_name[:80],
        "err_type": err_type,
        "message": message,
    }


def normalize_signature(text: str) -> list[dict]:
    """Return list of normalized error records from verify/bash output."""
    records: list[dict] = []
    if not text or ("FAIL" not in text and "Error" not in text):
        return records

    blocks = re.split(r"\[\d+/\d+\]", text)
    chunks = blocks[1:] if len(blocks) > 1 else ([text] if ("FAIL" in text or "Error" in text) else [])

    for block in chunks:
        parsed = parse_structured_block(block)
        if not parsed:
            continue
        msg = parsed["message"]
        family = "unknown"
        signature = msg

        if re.search(r"Failed to resolve import", msg, re.I):
            family = "import_resolve"
            m = re.search(r'Failed to resolve import "([^"]+)"', msg)
            signature = f'import_resolve|{m.group(1) if m else msg[:60]}'
        elif "expect is not defined" in msg:
            family = "missing_global_setup"
            signature = f"missing_global_setup|{parsed['file']}|expect is not defined"
        elif re.search(r"SyntaxError|Transform failed", msg, re.I):
            family = "syntax_transform"
            signature = f"syntax_transform|{parsed['file']}|{msg[:80]}"
        elif re.search(r"multiple elements|Found multiple", msg, re.I):
            family = "rtl_duplicate_element"
            m = re.search(r'name: "([^"]+)"|getByRole\([^)]+\)', msg)
            signature = f"rtl_duplicate|{m.group(1) if m else msg[:70]}"
        elif "Unable to find" in msg or "TestingLibraryElementError" in msg:
            family = "rtl_selector"
            m = re.search(
                r'role="([^"]+)"[^"]*name="([^"]+)"|'
                r'getByRole\(["\']([^"\']+)["\'](?:,\s*\{[^}]*name:\s*["\']([^"\']+)["\'])?|'
                r'text:?\s*([^.\n]+)|'
                r'getByText\(["\']([^"\']+)["\']|'
                r'getByLabelText\(["\']([^"\']+)["\']|'
                r'getByTestId\(["\']([^"\']+)["\']',
                msg,
                re.I,
            )
            if m:
                parts = [g for g in m.groups() if g]
                signature = f"rtl_selector|{'|'.join(parts[:3])}"
            else:
                snippet = _norm_ws(re.sub(r"TestingLibraryElementError:\s*", "", msg))[:90]
                signature = f"rtl_selector|{snippet}"
        elif "Expected" in msg or "Received" in msg or "AssertionError" in msg:
            family = "assertion"
            signature = f"assertion|{parsed['file']}|{msg[:90]}"
        elif parsed["err_type"]:
            family = parsed["err_type"].lower()
            signature = f"{family}|{parsed['file']}|{msg[:90]}"
        else:
            family = "unparsed"
            signature = f"unparsed|{parsed['file']}|{msg[:90]}"

        records.append(
            {
                "family": family,
                "signature": signature,
                "file": parsed["file"],
                "test_name": parsed["test_name"],
                "message": msg[:160],
            }
        )

    # Fallback for truncated raw_summary without structured blocks
    if not records and text:
        if "Failed to resolve import" in text:
            m = re.search(r'Failed to resolve import "([^"]+)"', text)
            records.append(
                {
                    "family": "import_resolve",
                    "signature": f"import_resolve|{m.group(1) if m else 'unknown'}",
                    "file": "",
                    "test_name": "",
                    "message": _norm_ws(text)[:160],
                }
            )
        elif "Unable to find" in text or "TestingLibraryElementError" in text:
            snippet = _norm_ws(text)[:100]
            records.append(
                {
                    "family": "rtl_selector",
                    "signature": f"rtl_selector|{snippet}",
                    "file": "",
                    "test_name": "",
                    "message": snippet,
                }
            )
        elif "expect is not defined" in text:
            records.append(
                {
                    "family": "missing_global_setup",
                    "signature": "missing_global_setup|expect is not defined",
                    "file": "",
                    "test_name": "",
                    "message": "expect is not defined",
                }
            )

    return records


def parse_failed_count(text: str) -> int | None:
    m = re.search(r"FAIL\s*(\d+)/(\d+)\s*tests\s*·\s*(\d+)\s*failed", text, re.I)
    if m:
        return int(m.group(3))
    return None


def categorize_actions(ledger: dict, from_call: int, to_call: int) -> dict:
    summary = Counter()
    details: list[str] = []
    new_test_files: list[str] = []
    debug_sidecar = False
    paths_touched: Counter = Counter()

    for call in ledger["calls"]:
        idx = call["index"]
        if idx <= from_call or idx >= to_call:
            continue
        for tool in call.get("tools", []):
            name = tool.get("name")
            detail = (tool.get("detail") or "")[:120]
            if name == "verify":
                summary["verify"] += 1
            elif name == "read":
                summary["read"] += 1
            elif name == "bash":
                if "debug.test" in detail or ("/tmp/" in detail and ".test." in detail):
                    summary["debug_sidecar_bash"] += 1
                    debug_sidecar = True
                    details.append(f"bash:debug_sidecar")
                elif re.search(r"vitest|npm test|grep", detail, re.I):
                    summary["bash_test_command"] += 1
                    details.append(f"bash:test_cmd")
                elif "grep" in detail or "find " in detail:
                    summary["bash_explore"] += 1
                    details.append("bash:explore")
                else:
                    summary["bash_other"] += 1
            elif name in ("write", "edit"):
                for p in tool.get("paths") or []:
                    p0 = p.split("\n")[0]
                    paths_touched[p0] += 1
                    if is_test_path(p0):
                        if "debug" in p0.lower():
                            summary["debug_test_write"] += 1
                            debug_sidecar = True
                            details.append(f"{name}:debug_test:{p0}")
                        else:
                            summary["test_edit"] += 1
                            details.append(f"{name}:test:{p0}")
                        if name == "write":
                            new_test_files.append(p0)
                    else:
                        summary["product_edit"] += 1
                        details.append(f"{name}:product:{p0}")

    strategy = "minimal"
    if debug_sidecar or summary["debug_sidecar_bash"] or summary["debug_test_write"]:
        strategy = "debug_sidecar"
    elif summary["test_edit"] >= 2 or len(new_test_files) > 0:
        strategy = "test_surface_change"
    elif summary["product_edit"] or summary["test_edit"]:
        strategy = "direct_repair"
    elif summary["verify"]:
        strategy = "verify_only"

    return {
        "strategy": strategy,
        "debug_sidecar": debug_sidecar,
        "counts": dict(summary),
        "paths_touched": dict(paths_touched.most_common(8)),
        "details": details[:12],
        "inter_calls": to_call - from_call - 1,
        "weighted": sum(
            c.get("weighted_cost", 0)
            for c in ledger["calls"]
            if from_call < c["index"] < to_call
        ),
    }


def build_run_error_timeline(run_id: str, meta: dict) -> dict | None:
    if not (ANALYSIS / run_id / "trajectory.v2.json").exists():
        return None
    events = canonical_verify_events(run_id)
    if not events:
        return None
    ledger = load_ledger(run_id)

    verify_steps = []
    all_sigs_by_step: list[list[str]] = []

    for i, ev in enumerate(events):
        sigs = normalize_signature(ev["text"])
        if not sigs and ev.get("raw_summary"):
            sigs = normalize_signature(ev["raw_summary"])
        sig_keys = [s["signature"] for s in sigs]
        all_sigs_by_step.append(sig_keys)
        verify_steps.append(
            {
                "ordinal": i + 1,
                "call_index": ev["call_index"],
                "failed_count": parse_failed_count(ev["text"]),
                "outcome": ev.get("outcome"),
                "signatures": sigs,
                "signature_keys": sig_keys,
            }
        )

    repeat_pairs = []
    # Consecutive VERIFY pairs where normalized signature persists
    for i in range(len(verify_steps) - 1):
        first_step = verify_steps[i]
        repeat_step = verify_steps[i + 1]
        shared = set(first_step["signature_keys"]) & set(repeat_step["signature_keys"])
        if not shared:
            continue
        for sig in shared:
            between = categorize_actions(
                ledger, first_step["call_index"], repeat_step["call_index"]
            )
            fail_before = first_step["failed_count"]
            fail_after = repeat_step["failed_count"]
            converging = (
                fail_before is not None
                and fail_after is not None
                and fail_after < fail_before
            )
            non_converging = (
                fail_before is not None
                and fail_after is not None
                and fail_after >= fail_before
            )
            repeat_pairs.append(
                {
                    "signature": sig,
                    "first_ordinal": first_step["ordinal"],
                    "repeat_ordinal": repeat_step["ordinal"],
                    "first_call": first_step["call_index"],
                    "repeat_call": repeat_step["call_index"],
                    "family": next(
                        (s["family"] for s in first_step["signatures"] if s["signature"] == sig),
                        "unknown",
                    ),
                    "failed_before": fail_before,
                    "failed_at_repeat": fail_after,
                    "converging": converging,
                    "non_converging": non_converging,
                    "actions_between": between,
                    "error_persisted": True,
                }
            )

    return {
        "run_id": run_id,
        "weighted": meta.get("weighted", 0),
        "calls": meta.get("calls", 0),
        "snowball": meta.get("snowball", False),
        "debug_sidecar": meta.get("debug_sidecar", False),
        "verify_steps": verify_steps,
        "repeat_pairs": repeat_pairs,
        "has_repeat": len(repeat_pairs) > 0,
    }


def action_label(actions: dict) -> str:
    c = actions.get("counts", {})
    parts = []
    if actions.get("debug_sidecar"):
        parts.append("debug_sidecar")
    if c.get("product_edit"):
        parts.append(f"product_edit×{c['product_edit']}")
    if c.get("test_edit"):
        parts.append(f"test_edit×{c['test_edit']}")
    if c.get("debug_test_write"):
        parts.append("debug_test_write")
    if c.get("bash_test_command"):
        parts.append(f"scoped_test_runs×{c['bash_test_command']}")
    if c.get("bash_explore"):
        parts.append("grep/explore")
    if c.get("verify"):
        parts.append(f"verify×{c['verify']}")
    if not parts:
        parts.append(actions.get("strategy", "minimal"))
    return " + ".join(parts)


def main() -> None:
    corpus = json.loads(CORPUS_PATH.read_text()).get("corpus", [])
    timelines = []
    for row in corpus:
        tl = build_run_error_timeline(row["run_id"], row)
        if tl:
            timelines.append(tl)

    snow_repeat = [t for t in timelines if t["snowball"] and t["has_repeat"]]
    recover_repeat = [t for t in timelines if not t["snowball"] and t["has_repeat"]]

    nonconv_snow = [
        p
        for t in snow_repeat
        for p in t["repeat_pairs"]
        if p.get("non_converging")
    ]
    conv_recover = [
        p
        for t in recover_repeat
        for p in t["repeat_pairs"]
        if p.get("converging")
    ]

    # Index signatures across corpus
    sig_index: dict[str, list[dict]] = defaultdict(list)
    for tl in timelines:
        for step in tl["verify_steps"]:
            for sig in step["signatures"]:
                key = sig["signature"]
                sig_index[key].append(
                    {
                        "run_id": tl["run_id"],
                        "snowball": tl["snowball"],
                        "weighted": tl["weighted"],
                        "ordinal": step["ordinal"],
                        "call_index": step["call_index"],
                        "failed_count": step["failed_count"],
                        "outcome": step["outcome"],
                        "family": sig["family"],
                    }
                )

    # Matched pairs: non-converging snowball repeat vs converging recovery with same signature
    matched_studies = []
    for tl in sorted(snow_repeat, key=lambda t: -t["weighted"]):
        for pair in tl["repeat_pairs"]:
            if not pair.get("non_converging") and not pair["actions_between"].get("debug_sidecar"):
                continue
            sig = pair["signature"]
            recovery_hits = [
                h
                for h in sig_index.get(sig, [])
                if h["run_id"] != tl["run_id"] and not next(
                    x for x in timelines if x["run_id"] == h["run_id"]
                )["snowball"]
            ]
            # Also try family-level fuzzy match if exact signature sparse
            family = pair["family"]
            family_recovery = []
            if len(recovery_hits) < 1:
                for key, hits in sig_index.items():
                    if not key.startswith(f"{family}|") and family not in key:
                        continue
                    for h in hits:
                        if h["run_id"] == tl["run_id"]:
                            continue
                        run_meta = next(x for x in timelines if x["run_id"] == h["run_id"])
                        if not run_meta["snowball"]:
                            family_recovery.append({**h, "matched_key": key})

            best_recovery = None
            recovery_actions = None
            if recovery_hits:
                # pick lowest cost recovery run
                best = min(recovery_hits, key=lambda h: h["weighted"])
                rec_tl = next(x for x in timelines if x["run_id"] == best["run_id"])
                # actions after this occurrence until next verify or pass
                next_step = next(
                    (s for s in rec_tl["verify_steps"] if s["ordinal"] == best["ordinal"] + 1),
                    None,
                )
                end_call = next_step["call_index"] if next_step else best["call_index"] + 5
                recovery_actions = categorize_actions(
                    load_ledger(best["run_id"]), best["call_index"], end_call
                )
                best_recovery = best
            elif family_recovery:
                best = min(family_recovery, key=lambda h: h["weighted"])
                rec_tl = next(x for x in timelines if x["run_id"] == best["run_id"])
                next_step = next(
                    (s for s in rec_tl["verify_steps"] if s["ordinal"] == best["ordinal"] + 1),
                    None,
                )
                end_call = next_step["call_index"] if next_step else best["call_index"] + 5
                recovery_actions = categorize_actions(
                    load_ledger(best["run_id"]), best["call_index"], end_call
                )
                best_recovery = {**best, "fuzzy_match": True}

            matched_studies.append(
                {
                    "snowball_run_id": tl["run_id"],
                    "snowball_weighted": tl["weighted"],
                    "signature": sig,
                    "family": family,
                    "first_ordinal": pair["first_ordinal"],
                    "repeat_ordinal": pair["repeat_ordinal"],
                    "failed_at_first": pair["failed_before"],
                    "failed_at_repeat": pair["failed_at_repeat"],
                    "converging": pair.get("converging"),
                    "non_converging": pair.get("non_converging"),
                    "snowball_actions_between": pair["actions_between"],
                    "snowball_action_summary": action_label(pair["actions_between"]),
                    "error_persisted": pair["error_persisted"],
                    "recovery_match": best_recovery,
                    "recovery_actions": recovery_actions,
                    "recovery_action_summary": action_label(recovery_actions) if recovery_actions else None,
                }
            )

    # Aggregate: signature -> bad vs good responses
    error_memory_candidates: dict[str, dict] = {}
    for study in matched_studies:
        sig = study["signature"]
        if sig not in error_memory_candidates:
            error_memory_candidates[sig] = {
                "family": study["family"],
                "signature": sig,
                "snowball_examples": [],
                "recovery_examples": [],
                "bad_responses": Counter(),
                "good_responses": Counter(),
            }
        em = error_memory_candidates[sig]
        em["snowball_examples"].append(study["snowball_run_id"])
        em["bad_responses"][study["snowball_action_summary"]] += 1
        if study.get("recovery_action_summary"):
            em["recovery_examples"].append(study["recovery_match"]["run_id"])
            em["good_responses"][study["recovery_action_summary"]] += 1

    error_memory_table = []
    for sig, em in sorted(error_memory_candidates.items(), key=lambda x: -len(x[1]["snowball_examples"])):
        error_memory_table.append(
            {
                "signature": sig,
                "family": em["family"],
                "snowball_n": len(set(em["snowball_examples"])),
                "recovery_n": len(set(em["recovery_examples"])),
                "known_bad_responses": em["bad_responses"].most_common(5),
                "verified_successful_responses": em["good_responses"].most_common(5),
            }
        )

    # Signature-level stats
    sig_stats = []
    for sig, hits in sig_index.items():
        if len(hits) < 3:
            continue
        runs = {h["run_id"] for h in hits}
        snow_runs = {h["run_id"] for h in hits if h["snowball"]}
        sig_stats.append(
            {
                "signature": sig,
                "occurrences": len(hits),
                "runs": len(runs),
                "snowball_run_rate": round(len(snow_runs) / len(runs), 3),
                "median_run_weighted": round(median(h["weighted"] for h in hits)),
            }
        )
    sig_stats.sort(key=lambda x: -x["occurrences"])

    output = {
        "schema": "agentcofounder.matched_repair_strategy.v1",
        "generated": "2026-09-02",
        "methodology": {
            "normalized_signature": "family + structured message (import path, RTL role/name/text, file)",
            "not_broad_class": "rtl_other class avoided for repeat detection where possible",
            "cohorts": {
                "snowball_with_consecutive_repeat": len(snow_repeat),
                "recover_with_consecutive_repeat": len(recover_repeat),
                "non_converging_repeat_transitions_snowball": len(nonconv_snow),
                "converging_repeat_transitions_recover": len(conv_recover),
            },
        "loss_of_convergence": {
            "snowball_non_converging_action_counts": dict(
                Counter(action_label(p["actions_between"]) for p in nonconv_snow).most_common(10)
            ),
            "recover_converging_action_counts": dict(
                Counter(action_label(p["actions_between"]) for p in conv_recover).most_common(10)
            ),
        },
        },
        "synthesis_corrections": {
            "preventable_share": "NOT quantified; prevention candidates remain observational only",
            "repeat_detection": "uses normalized signature, not broad error class alone",
        },
        "matched_studies": matched_studies[:60],
        "error_memory_preliminary_table": error_memory_table[:40],
        "signature_stats": sig_stats[:50],
        "snowball_repeat_run_ids": [t["run_id"] for t in snow_repeat],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, indent=2), encoding="utf-8")

    print(f"Wrote {OUT}")
    print(f"Snowball with repeated normalized sig: {len(snow_repeat)}/{sum(1 for t in timelines if t['snowball'])}")
    print(f"Recover with consecutive repeat: {len(recover_repeat)}")
    print(f"Matched studies: {len(matched_studies)}")

    print("\nError memory preliminary (top):")
    for row in error_memory_table[:12]:
        print(f"\n  {row['signature'][:90]}")
        print(f"    snow={row['snowball_n']} recover={row['recovery_n']}")
        if row["known_bad_responses"]:
            print(f"    BAD:  {row['known_bad_responses'][0]}")
        if row["verified_successful_responses"]:
            print(f"    GOOD: {row['verified_successful_responses'][0]}")

    # 303k specific
    rid = "2026-09-01T08-26-55-487Z"
    tl303 = next((t for t in timelines if t["run_id"] == rid), None)
    if tl303:
        print(f"\n303k repeat pairs: {len(tl303['repeat_pairs'])}")
        for p in tl303["repeat_pairs"][:5]:
            print(f"  {p['signature'][:70]}")
            print(f"    actions: {action_label(p['actions_between'])}")


if __name__ == "__main__":
    main()
