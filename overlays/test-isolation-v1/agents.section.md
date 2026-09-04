## Test isolation (preinstalled)

- For tests touching durable storage, prefer `createMemoryStorage()` from `@/test/memoryStorage` so storage **does not leak between tests**.
- Reset or inject isolated storage in `beforeEach` when tests mutate persisted state.
- Do not hand-roll ad hoc `localStorage` mocks when the preinstalled helper suffices.
