# Next slice: after MULTIPLE — COPY_NAME_MISS dominates ship fails (2026-09-04)

**Status:** DIRECTION LOCK (measurement only; no experiment)  
**Prior:** [measurement-multiple-first-repair-2026-09-04.md](./measurement-multiple-first-repair-2026-09-04.md) — A/B/C bucket n=5, no dominant MULTIPLE-repair target → **park**

---

## Why leave MULTIPLE A/B/C

Bucket is 2/2/1. No mechanism to build. Reporter is fine. Growing n further is low EV for one-run probes.

---

## Ship-keep VERIFY sequences (n=12)

First FAIL class:

| Class | n |
|-------|--:|
| **COPY_NAME_MISS** | **5** |
| MULTIPLE | 4 |
| TYPECHECK | 2 |
| PASS (no fail) | 1 |

After a MULTIPLE fail, next VERIFY class:

| Next | n |
|------|--:|
| **COPY_NAME_MISS** | **3** |
| SUITE_TRANSFORM | 1 |
| MULTIPLE again | 1 |

Expensive tails are often **COPY loops**, not MULTIPLE:

- `14-48-25` — **8× COPY_NAME_MISS** → 148k  
- `16-43-18` — 3× COPY → 116k  
- `14-37-34` — 3× COPY → 72k  

A-labeled MULTIPLE hits (`16-52-11`, `19-04-38`) both hand off to **COPY** next. That is why A’s attributable $ is large even when MULTIPLE “worked.”

---

## Next research question

```text
COMPLETE evidence (text/role inventory) on COPY_NAME_MISS
∩ first repair / next VERIFY still red
→ same discipline as MULTIPLE:
   FIXED_COPY_NEXT_OTHER | BOTCHED | WIDEN_ESCAPE | IGNORED_FACTS
→ cost fail→green, extra VERIFY cycles
→ A does not count as “failed COPY repair”
→ choose later work by attributable $
```

**Not:** PRE_TEST / source facts (already DROP — composition, not missing literals).  
**Not:** another MULTIPLE reporter tweak.

---

## One-line

> **Park MULTIPLE A/B/C; COPY first-repair also PARKED (IGNORED_FACTS ceiling) — see [measurement-copy-first-repair-2026-09-04.md](./measurement-copy-first-repair-2026-09-04.md).**
