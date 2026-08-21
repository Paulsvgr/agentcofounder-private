# Practice runs

Log of local challenge runs used to check the environment without burning the official GLM 5.2 budget.

Official judging still uses `source ~/.pi/agent/challenge-env.sh` (`zai-org/GLM-5.2`, thinking off). These notes are not a scoring record.

## 2026-08-21 — first cheap full run (Qwen)

### Change

No harness or `solution/` code was changed. The only switch was the practice env, which overrides the default GLM model:

| Variable | Default (`challenge-env.sh`) | This run (`challenge-env-qwen.sh`) |
| --- | --- | --- |
| `CHALLENGE_PROVIDER` | `berget` | `berget` |
| `CHALLENGE_MODEL` | `zai-org/GLM-5.2` | `Qwen/Qwen3.8-27B-FP8` |
| `CHALLENGE_THINKING` | `off` | `off` |

Commands:

```bash
source ~/.pi/agent/challenge-env-qwen.sh
npm run challenge
```

Idea file: `contract-public/development-idea.txt` (family bookshelf / lend-and-return placeholder).

### Result

| Field | Value |
| --- | --- |
| Wall clock | 2026-08-21 18:35:05–18:45:49 CEST (~10.7 min) |
| Process exit | `0` |
| `result.json` status | `success` |
| Pi exit | `0` |
| Model | `berget/Qwen/Qwen3.8-27B-FP8` |
| Model calls | 19 |
| Input / output / total tokens | 253959 / 11675 / 265634 |
| Cache read / write | 0 / 0 |
| Reasoning tokens | 0 |
| Provider `cost_total` | 0 (Berget did not report a monetary cost on this stream) |
| Vitest journeys in `tests_run` | 15, all `passed` |
| Harness checks | Vitest report, `npm run build`, `npm run dev` on port 3000 — all `passed` |
| Port 3000 after Pi | free (no reclamation) |

Generated app: `output/app/` (Family Bookshelf, localStorage). Audit dir: `artifacts/runs/2026-08-21T16-35-16-110Z`. Console log: `artifacts/practice-run-qwen.log` (gitignored).

### Takeaway

Qwen completed the public development idea end-to-end on the stock runner. Use this path to check auth, Pi, and the harness. Re-run with `challenge-env.sh` before treating a result as judging-shaped.
