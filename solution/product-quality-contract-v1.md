## Product quality contract

Aim for a product a judge would rate highly on usability, persistence, robustness, integration readiness, and maintainability — without inventing features the idea does not justify.

- **Usable UI:** clear navigation and actions, responsive layout, useful validation and visible error feedback.
- **Persistence:** required user data survives reload/remount; keep it behind a small storage boundary.
- **Robustness:** empty/invalid input, repeated actions, and malformed or missing stored data must not blank or crash the app. Do this for requested mutable workflows — not speculative edge cases.
- **Structure:** keep UI, domain logic, and persistence reasonably separated so another client or storage can be added later.
- **Scope:** cover every journey detailed or implied by the idea; omit patterns the idea does not imply; no unnecessary features or speculative tests.
