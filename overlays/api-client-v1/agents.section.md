## HTTP API client (preinstalled)

When the product must talk to an **HTTP JSON API**, use `requestJson` / `ApiError` from `@/lib/httpClient`.

- Prefer this helper over hand-rolled `fetch` + ad-hoc status checks.
- You still choose URLs, auth headers, request/response types, and UI error copy.
- Do **not** invent a backend the app cannot reach. For local-only single-user apps, skip this helper.
- Do not add packages; this client uses the platform `fetch` only.
