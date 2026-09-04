# Experiment: Root-error-first VERIFY v1.1 (coverage follow-up)

**ID:** `root-error-first-v1-1`  
**Arm:** treatment  
**Comparator:** `css-persistence-v1` (median ~105k) and inert `root-error-first-v1` (median ~83k, 0/14 ROOT sections)

## Why a follow-up

v1 never fired: first FAILs were RTL-only. Replay also showed v1 would miss the real css-persistence suite error:

```text
TYPE  Error
TEST  (suite)
MESSAGE
Failed to resolve import "./collectionStore" from "src/bookStore.ts". Does the file exist?
```

## Treatment (only)

Same frozen stack as v1:

- `HARNESS_OWNED_VERIFY=1`
- `TEMPLATE_CSS_VOCABULARY=1`
- `TEMPLATE_PERSISTENCE=1`
- `HARNESS_ROOT_ERROR_FIRST_V1=1`
- Error Memory / verify-repair / tsc / prompts / overlays **OFF**

**Code change vs v1:** classify Vite import-resolution / module-not-found messages as root even when TYPE is generic `Error`. Still no hints, no tsc, no prompts.

## Hypothesis

When VERIFY contains an extractable module/runtime/suite error, ROOT labeling fires (`changed=true`). First-diagnosis accuracy is only scored on those runs. RTL-only FAILs remain unchanged (same as v1).

## Gates

Same as v1. Primary learning metric remains first-diagnosis accuracy **when a root signal is present**. Tripwire: stop and inspect any >140–150k run with a clearly wrong diagnosis.

## Cohort

```bash
npm run experiment:root-error-first-v1-1
```
