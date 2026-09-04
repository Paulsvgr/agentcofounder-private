# Parked: product-quality prompt / skill tightening

**Status:** **UNPARKED → IN PROGRESS** — see [experiment-product-quality-contract-v1-preregistration.md](./experiment-product-quality-contract-v1-preregistration.md)  
**Why was parked:** Prompt changes would contaminate the MULTIPLE-evidence experiment (now KEEP / closed).

## Intent (locked)

Tell Pi **what a good product must do**, not how the judge awards points. No `UX=30 / Persistence=20 / …` dump.

Draft Required outcome shape (now shipped as `solution/product-quality-contract-v1.md`):

```text
Required product behavior

- Clear, responsive, intuitive UI with useful validation and error feedback.
- Required user data survives reload/remount.
- Keep persistence behind a small storage boundary.
- Malformed or missing stored data must not blank/crash the app.
- For mutable data, handle empty/invalid input and repeated actions safely.
- Keep UI, domain logic, and persistence reasonably separated.
```

Also resolve the tension:

```text
system prompt: handle invalid / empty / repeated actions
skill: don't add speculative edge cases
```

→ Obvious robustness for requested mutable workflows is required; speculative features/tests are not. Smallest sufficient journey suite stays.

## Not in this track

- Error Memory, `rg`, VERIFY reporter changes  
- Reopening repair-tail KEEPs  
- Control App
