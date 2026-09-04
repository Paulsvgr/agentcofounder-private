# Public journey guidance

The input idea is authoritative. Use these patterns as a coverage check — not a feature shopping list.

## Behaviors to implement and test when implied

Aim for **≤10 high-information UI journeys**. Combine multiple rubric pillars in one test when possible. Prefer UI journeys over domain/repo unit suites.

1. Add the idea's complete primary record and show it in the collection (empty state → after add); prefer combining with edit/delete+confirm in one high-info CRUD journey when practical.
2. Edit and delete an existing record (confirm before destructive delete).
3. Narrow the collection by category/type; include empty-filter feedback in the same test when cheap.
4. Show a derived callout the idea requests (e.g. low-stock badge). Keep list order stable; do not re-sort under the user on +/-.
5. Preserve required data across a browser refresh.
6. Forms: one test for visible validation + `aria-invalid` + announced error (not only disabled submit).
7. Persistence robustness: **one** test covering malformed stored JSON recovery **or** a surfaced save/quota failure.
8. When in-list adjust exists: **one** multi-item test that asserts value change **and** stable row order with scoped queries.

Implement every behavior the idea details or implies; never drop an implied behavior merely to simplify the application. If the idea does not imply a listed pattern, omit it instead of inventing an equivalent feature, and record why in `assumptions`. Do not invent extra edge-case tests beyond this list.

## Run and reporting requirements

- Start at `http://localhost:3000` without errors.
- Record the decision made for the idea's ambiguity in `assumptions`.

The runner verifies startup, and the result report carries assumptions. These are not user behaviors that need Vitest/jsdom coverage.
