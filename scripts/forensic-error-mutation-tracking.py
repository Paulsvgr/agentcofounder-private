#!/usr/bin/env python3
"""Error mutation tracking: signature change + failure-count trajectory."""

from __future__ import annotations

import importlib.util
import json
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
CORPUS_PATH = ROOT / "artifacts/forensic/first-verify-corpus-v1.json"
OUT = ROOT / "artifacts/forensic/error-mutation-tracking-v1.json"

# Reuse signature parsing from matched-repair study
_spec = importlib.util.spec_from_file_location(
    "mrs", ROOT / "scripts/forensic-matched-repair-strategy.py"
)
_mrs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mrs)


@dataclass
class VerifyTransition:
    run_id: str
    snowball: bool
    weighted: float
    from_ordinal: int
    to_ordinal: int
    from_call: int
    to_call: int
    failed_before: int | None
    failed_after: int | None
    sigs_before: list[str]
    sigs_after: list[str]
    persisted: list[str]
    resolved: list[str]
    new_errors: list[str]
    mutation: bool
    fail_delta: int | None
    classification: str
    post_strategy: str
    debug_sidecar: bool
    inter_weighted: float


def classify_transition(
    failed_before: int | None,
    failed_after: int | None,
    sigs_before: list[str],
    sigs_after: list[str],
) -> tuple[str, bool, list[str], list[str], list[str]]:
    before = set(sigs_before)
    after = set(sigs_after)
    persisted = sorted(before & after)
    resolved = sorted(before - after)
    new_errors = sorted(after - before)
    mutation = before != after and bool(before) and bool(after)

    if failed_before is None or failed_after is None:
        if not sigs_after and sigs_before:
            return "converging", mutation, persisted, resolved, new_errors
        if mutation:
            return "mutation_unknown_count", mutation, persisted, resolved, new_errors
        if persisted and not new_errors and not resolved:
            return "stalled", mutation, persisted, resolved, new_errors
        return "unknown_count", mutation, persisted, resolved, new_errors

    delta = failed_after - failed_before

    if failed_after == 0 or (failed_before > 0 and failed_after == 0):
        return "converging", mutation, persisted, resolved, new_errors

    if not mutation:
        if delta < 0:
            return "converging", mutation, persisted, resolved, new_errors
        if delta == 0:
            return "stalled", mutation, persisted, resolved, new_errors
        return "regressing", mutation, persisted, resolved, new_errors

    # Signature mutated
    if delta < 0:
        return "converging", mutation, persisted, resolved, new_errors
    if delta == 0:
        return "stalled", mutation, persisted, resolved, new_errors
    return "regressing", mutation, persisted, resolved, new_errors


def build_transitions(run_id: str, meta: dict) -> list[VerifyTransition]:
    tl = _mrs.build_run_error_timeline(run_id, meta)
    if not tl or len(tl["verify_steps"]) < 2:
        return []

    ledger = _mrs.load_ledger(run_id)
    out: list[VerifyTransition] = []

    steps = tl["verify_steps"]
    for i in range(len(steps) - 1):
        a, b = steps[i], steps[i + 1]
        fb, fa = a["failed_count"], b["failed_count"]
        fail_delta = (fa - fb) if fb is not None and fa is not None else None
        actions = _mrs.categorize_actions(ledger, a["call_index"], b["call_index"])
        cls, mutation, persisted, resolved, new_errors = classify_transition(
            fb, fa, a["signature_keys"], b["signature_keys"]
        )
        out.append(
            VerifyTransition(
                run_id=run_id,
                snowball=bool(meta.get("snowball")),
                weighted=float(meta.get("weighted", 0)),
                from_ordinal=a["ordinal"],
                to_ordinal=b["ordinal"],
                from_call=a["call_index"],
                to_call=b["call_index"],
                failed_before=fb,
                failed_after=fa,
                sigs_before=a["signature_keys"],
                sigs_after=b["signature_keys"],
                persisted=persisted,
                resolved=resolved,
                new_errors=new_errors,
                mutation=mutation,
                fail_delta=fail_delta,
                classification=cls,
                post_strategy=actions["strategy"],
                debug_sidecar=actions["debug_sidecar"],
                inter_weighted=actions["weighted"],
            )
        )
    return out


def summarize(transitions: list[VerifyTransition]) -> dict:
    if not transitions:
        return {"n": 0}
    cls = Counter(t.classification for t in transitions)
    return {
        "n": len(transitions),
        "by_class": dict(cls),
        "mutation_rate": round(sum(t.mutation for t in transitions) / len(transitions), 3),
        "debug_sidecar_rate": round(sum(t.debug_sidecar for t in transitions) / len(transitions), 3),
        "median_inter_weighted": round(median(t.inter_weighted for t in transitions)),
        "median_fail_delta": round(median(t.fail_delta for t in transitions if t.fail_delta is not None), 2)
        if any(t.fail_delta is not None for t in transitions)
        else None,
    }


def main() -> None:
    corpus = json.loads(CORPUS_PATH.read_text()).get("corpus", [])
    all_transitions: list[VerifyTransition] = []

    for row in corpus:
        all_transitions.extend(build_transitions(row["run_id"], row))

    snowball_runs = {t.run_id for t in all_transitions if t.snowball}
    cheap_runs = {
        row["run_id"]
        for row in corpus
        if not row.get("snowball") and row.get("weighted", 0) < 70_000
    }
    recover_runs = {
        row["run_id"]
        for row in corpus
        if not row.get("snowball") and row.get("weighted", 0) >= 70_000
    }

    def filt(fn):
        return [t for t in all_transitions if fn(t)]

    mutation_regressing = [t for t in all_transitions if t.classification == "regressing" and t.mutation]
    mutation_converging = [t for t in all_transitions if t.classification == "converging" and t.mutation]
    mutation_stalled = [t for t in all_transitions if t.classification == "stalled" and t.mutation]
    regressing_any = [t for t in all_transitions if t.classification == "regressing"]
    converging_any = [t for t in all_transitions if t.classification == "converging"]

    snow_mut_regress = [t for t in mutation_regressing if t.snowball]
    recover_mut_converge = [t for t in mutation_converging if not t.snowball]
    cheap_mut_converge = [
        t for t in mutation_converging if t.run_id in cheap_runs
    ]

    # Escalation signals on mutation-regressing (snowball)
    def escalation_profile(transitions: list[VerifyTransition]) -> dict:
        if not transitions:
            return {"n": 0}
        return {
            "n": len(transitions),
            "debug_sidecar_rate": round(sum(t.debug_sidecar for t in transitions) / len(transitions), 3),
            "post_strategy": dict(Counter(t.post_strategy for t in transitions).most_common()),
            "median_inter_weighted": round(median(t.inter_weighted for t in transitions)),
            "median_fail_delta": round(median(t.fail_delta for t in transitions if t.fail_delta is not None), 2),
            "runs": len({t.run_id for t in transitions}),
        }

    # Compare healthy big-drop mutations (11→1 style)
    big_drop = [
        t
        for t in mutation_converging
        if t.failed_before is not None
        and t.failed_after is not None
        and t.fail_delta is not None
        and t.fail_delta <= -5
    ]
    small_regress = [
        t
        for t in mutation_regressing
        if t.failed_before is not None
        and t.failed_after is not None
        and t.fail_delta is not None
        and t.fail_delta >= 1
    ]

    # Proposed operational definitions (evidence-informed, not intervention)
    definitions = {
        "converging": {
            "definition": (
                "Failure count decreased OR reached zero after a VERIFY transition, "
                "regardless of whether error signatures mutated. Includes large healthy drops "
                "(e.g. 11→1 with different dominant errors) where the workspace is measurably closer to green."
            ),
            "operational_rules": [
                "failed_after < failed_before when both counts known",
                "failed_after == 0",
                "OR canonical outcome passes on next VERIFY",
            ],
            "corpus_rate_all_transitions": round(
                len(converging_any) / len(all_transitions), 3
            )
            if all_transitions
            else 0,
            "snowball_run_involvement": round(
                len({t.run_id for t in converging_any if t.snowball})
                / len(snowball_runs),
                3,
            )
            if snowball_runs
            else 0,
        },
        "stalled": {
            "definition": (
                "Failure count unchanged AND repair did not eliminate the failure set: "
                "either the same normalized signature persists, or signatures mutate laterally "
                "without net improvement (fail count flat)."
            ),
            "operational_rules": [
                "failed_after == failed_before when both known",
                "AND (signature intersection non-empty OR both VERIFY still failing)",
            ],
            "corpus_rate": round(
                len([t for t in all_transitions if t.classification == "stalled"])
                / len(all_transitions),
                3,
            )
            if all_transitions
            else 0,
        },
        "regressing": {
            "definition": (
                "Failure count increased after a VERIFY transition. "
                "When combined with signature mutation, this is the 303k #2→#3 pattern: "
                "errors changed but the workspace got worse — a same-signature detector would miss it."
            ),
            "operational_rules": [
                "failed_after > failed_before when both counts known",
                "Signature mutation optional but flags 'error churn' when present",
            ],
            "corpus_rate": round(len(regressing_any) / len(all_transitions), 3)
            if all_transitions
            else 0,
            "mutation_regressing_n": len(mutation_regressing),
            "snowball_mutation_regressing_n": len(snow_mut_regress),
        },
        "escalation_signals_not_interventions": {
            "note": (
                "These are observational triggers for future experiment design. "
                "NOT proven interventions. Do not hard-code blocking."
            ),
            "debug_sidecar_created": "Strong snowball escalation signal when combined with stalled/regressing",
            "same_normalized_signature_consecutive": "Stalled signal",
            "failure_count_increase_after_repair": "Regressing signal (includes mutation case)",
            "high_inter_verify_cost_with_flat_or_rising_failures": "Context snowball warning",
        },
    }

    exemplars = []
    for label, items in [
        ("healthy_mutation_big_drop", sorted(big_drop, key=lambda t: t.fail_delta or 0)[:5]),
        ("unhealthy_mutation_regress_snowball", sorted(snow_mut_regress, key=lambda t: -t.weighted)[:12]),
        ("recover_mutation_converge", sorted(recover_mut_converge, key=lambda t: t.weighted)[:5]),
    ]:
        for t in items:
            exemplars.append(
                {
                    "label": label,
                    **asdict(t),
                    "sig_summary": {
                        "resolved": t.resolved[:3],
                        "new": t.new_errors[:3],
                        "persisted": t.persisted[:3],
                    },
                }
            )

    output = {
        "schema": "agentcofounder.error_mutation_tracking.v1",
        "generated": "2026-09-02",
        "status": "FINAL_FORENSIC_ANALYSIS",
        "next_step": "Design first snowball-prevention experiment (no further forensic analysis)",
        "corpus_transitions": len(all_transitions),
        "summary_by_cohort": {
            "all": summarize(all_transitions),
            "snowball_runs": summarize(filt(lambda t: t.snowball)),
            "cheap_runs": summarize(filt(lambda t: t.run_id in cheap_runs)),
            "recover_runs": summarize(filt(lambda t: t.run_id in recover_runs)),
        },
        "mutation_analysis": {
            "mutation_regressing_total": len(mutation_regressing),
            "mutation_regressing_snowball": len(snow_mut_regress),
            "mutation_regressing_snowball_runs": len({t.run_id for t in snow_mut_regress}),
            "mutation_converging_total": len(mutation_converging),
            "mutation_converging_cheap": len(cheap_mut_converge),
            "mutation_stalled_total": len(mutation_stalled),
            "snowball_mutation_regressing_profile": escalation_profile(snow_mut_regress),
            "healthy_big_drop_profile": escalation_profile(big_drop),
            "small_regress_profile": escalation_profile(small_regress),
        },
        "distinguish_progress_vs_regression": {
            "healthy_mutation": {
                "pattern": "fail_count decreases (often sharply) even when all signatures change",
                "example": "303k VERIFY 1→2: 11→1, import/setup errors replaced by single import error",
                "median_fail_delta": escalation_profile(big_drop).get("median_fail_delta"),
                "debug_sidecar_rate": escalation_profile(big_drop).get("debug_sidecar_rate"),
            },
            "unhealthy_mutation": {
                "pattern": "fail_count increases after repair despite signatures changing",
                "example": "303k VERIFY 2→3: 1→4, import error replaced by RTL duplicate errors",
                "median_fail_delta": escalation_profile(small_regress).get("median_fail_delta"),
                "debug_sidecar_rate": escalation_profile(small_regress).get("debug_sidecar_rate"),
                "snowball_concentration": f"{len(snow_mut_regress)}/{len(mutation_regressing)} mutation-regressing transitions are snowball runs",
            },
            "reliable_discriminators": [
                "fail_delta sign: negative = progress, positive = regression (primary)",
                "debug_sidecar on next transition: escalation signal (not intervention)",
                "inter_verify weighted cost: median higher on snowball mutation-regress (see profiles)",
                "persistence of non-convergence over 2+ transitions: stalled→regressing chain",
            ],
        },
        "operational_definitions": definitions,
        "exemplars": exemplars,
        "transitions": [asdict(t) for t in all_transitions],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, indent=2), encoding="utf-8")

    print(f"Wrote {OUT}")
    print(f"Total VERIFY transitions: {len(all_transitions)}")
    print(f"Mutation + regressing: {len(mutation_regressing)} (snowball: {len(snow_mut_regress)})")
    print(f"Mutation + converging: {len(mutation_converging)} (cheap: {len(cheap_mut_converge)})")
    print(f"Big-drop healthy mutations: {len(big_drop)}")
    mr = output["mutation_analysis"]
    print(f"\nSnowball mutation-regress profile: {mr['snowball_mutation_regressing_profile']}")
    print(f"Healthy big-drop profile: {mr['healthy_big_drop_profile']}")


if __name__ == "__main__":
    main()
