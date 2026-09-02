# Exp1 — RTL test cleanup

**Phase F verdict:** KEEP  
**Type:** test infrastructure (domain-neutral)

## Problem

React Testing Library leaves mounted DOM between tests. Later tests can fail with “multiple elements found” or stale nodes even when the app logic is fine. That triggers repair loops that look like product bugs.

## Change

Add automatic cleanup after every test:

**File:** `app-template/src/test/setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
```

## What this does **not** do

- Does not prescribe how the app stores data or structures components.
- Does not add seed libraries or hooks.
- Does not change harness measurement (`result.json`, token telemetry).

## How to revert

Remove the `cleanup` import and `afterEach(cleanup)` from `app-template/src/test/setup.ts`.
