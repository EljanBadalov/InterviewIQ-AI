# Consolidation audit

## Scope and safety

Audited project client/server/qwen-server, root deployment files, tracked file inventory, and the explicitly named external task/models directories. No personal directory crawl was performed. No external file was deleted, rewritten, or moved. No model/driver/system binary was downloaded or copied except the explicitly authorized verified GGUF.

## Verified external dependency mapping

External task directory: `C:\Users\Asus\Documents\Codex\2026-10-23\files-pasted-by-the-user-master`.

| Original | Consolidated destination | Purpose | Original |
|---|---|---|---|
| `qwen16-pilot-20261027/qwen17-controlled-start.py` (same approved 16-layer safety procedure) | `local-ai/safety/qwen_monitor.py` + `runtime_config.py` | Portable path/integrity resolver, same profile/gates, unique sessions, mutex, owned-handle shutdown | untouched |
| `safe-local-backend.cjs` | `local-ai/launchers/safe-local-backend.cjs` | Safe local backend; project-relative cwd, no index/create/recovery writes | untouched |
| `verify-backend-three-fixes-load.cjs` | `local-ai/launchers/verify-backend.cjs` | Startup code/version checks | untouched |
| `mock-test-proxy-runtime.py`, `verify-three-fixes-proxy-runtime.py` | `qwen-server/run_proxy.py`, `local_runtime.py`; `local-ai/launchers/start-proxy.py` delegates | Single canonical no-start/protected proxy | untouched |
| Existing repo `server/docs/phase4/real-qwen-checkpoint-a-2026-10-26/no_start_proxy.py` | same file becomes compatibility import of canonical runtime | Preserve historical callers without duplicated runtime | shim updated |
| `C:\Users\Asus\Documents\Codex\models\Qwen3-1.7B-Q4_K_M.gguf` | `local-ai/models/Qwen3-1.7B-Q4_K_M.gguf` | Same verified model; exact size/hash matched | untouched |
| Existing repo `read_ram.py` diagnostic logic | `local-ai/scripts/check-resources.py` uses canonical monitor resources function | GET/read-only resource check; no duplicate implementation | untouched |
| WinGet llama-server executable | system installation retained; `executable_path()` resolves and hashes it | External system prerequisite, not a copied binary | untouched |

The model copy checked free disk space first (~60.05 GiB), expected 1,282,439,264 bytes and SHA256, then verified the destination. About 58.8 GiB remained after copying. No existing 4B model was touched.

## External top-level file classification

| File | Classification | Action |
|---|---|---|
| `apply-interview-acceptance.py` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `B5-Audit-Progress-Fixture.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `B5-Checkpoint-A-Audit-and-Plan.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `backend-before-chat-fix.stderr.log` | generated log/state | preserved; not bulk-copied |
| `backend-before-chat-fix.stdout.log` | generated log/state | preserved; not bulk-copied |
| `backend-launch.stderr.log` | generated log/state | preserved; not bulk-copied |
| `backend-launch.stdout.log` | generated log/state | preserved; not bulk-copied |
| `career-chat-all-regressions.log` | generated log/state | preserved; not bulk-copied |
| `career-chat-baseline-hook.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `career-chat-latency-benchmark.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `career-chat-latency-fix-report.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `career-chat-legacy-before.log` | generated log/state | preserved; not bulk-copied |
| `career-chat-targeted-tests.log` | generated log/state | preserved; not bulk-copied |
| `critical-interview-diagnostic-tests.log` | generated log/state | preserved; not bulk-copied |
| `download-qwen17.py` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `frontend-launch.stderr.log` | generated log/state | preserved; not bulk-copied |
| `frontend-launch.stdout.log` | generated log/state | preserved; not bulk-copied |
| `hybrid-backend-regressions.log` | generated log/state | preserved; not bulk-copied |
| `hybrid-backend-targeted.log` | generated log/state | preserved; not bulk-copied |
| `hybrid-frontend-build.log` | generated log/state | preserved; not bulk-copied |
| `hybrid-frontend-tests.log` | generated log/state | preserved; not bulk-copied |
| `hybrid-python-tests.log` | generated log/state | preserved; not bulk-copied |
| `inspect-qwen17.py` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `interview-acceptance-backend-process.json` | generated log/state | preserved; not bulk-copied |
| `interview-acceptance-backend.stderr.log` | generated log/state | preserved; not bulk-copied |
| `interview-acceptance-backend.stdout.log` | generated log/state | preserved; not bulk-copied |
| `interview-acceptance-prompt-comparison.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `interview-acceptance-recovery-process.json` | generated log/state | preserved; not bulk-copied |
| `interview-acceptance-recovery.stderr.log` | generated log/state | preserved; not bulk-copied |
| `interview-acceptance-recovery.stdout.log` | generated log/state | preserved; not bulk-copied |
| `interview-acceptance-regressions.log` | generated log/state | preserved; not bulk-copied |
| `interview-acceptance-targeted.log` | generated log/state | preserved; not bulk-copied |
| `interview-activation-backend.stderr.log` | generated log/state | preserved; not bulk-copied |
| `interview-activation-backend.stdout.log` | generated log/state | preserved; not bulk-copied |
| `interview-activation-rollback-manifest.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `interview-foundation-regressions.log` | generated log/state | preserved; not bulk-copied |
| `interview-foundation-targeted.log` | generated log/state | preserved; not bulk-copied |
| `interview-foundation-tests.log` | generated log/state | preserved; not bulk-copied |
| `interview-three-fixes-backend-regressions.log` | generated log/state | preserved; not bulk-copied |
| `interview-three-fixes-backend-targeted.log` | generated log/state | preserved; not bulk-copied |
| `interview-three-fixes-frontend-regressions.log` | generated log/state | preserved; not bulk-copied |
| `interview-three-fixes-frontend-targeted.log` | generated log/state | preserved; not bulk-copied |
| `interview-three-fixes-proxy-tests.log` | generated log/state | preserved; not bulk-copied |
| `InterviewIQ-Checkpoint-A.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `llama-devices.stderr.log` | generated log/state | preserved; not bulk-copied |
| `llama-devices.stdout.log` | generated log/state | preserved; not bulk-copied |
| `mock-interview-acceptance-report-2026-10-27.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `mock-interview-activation-preflight.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `mock-interview-foundation-report-2026-10-27.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `mock-interview-safe-activation-2026-10-27.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `mock-interview-three-fixes-report.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `mock-test-frontend.stderr.log` | generated log/state | preserved; not bulk-copied |
| `mock-test-frontend.stdout.log` | generated log/state | preserved; not bulk-copied |
| `mock-test-proxy-ready.stderr.log` | generated log/state | preserved; not bulk-copied |
| `mock-test-proxy-ready.stdout.log` | generated log/state | preserved; not bulk-copied |
| `mock-test-proxy-runtime.py` | essential runtime/activation; consolidated | preserved; not bulk-copied |
| `mock-test-proxy.stderr.log` | generated log/state | preserved; not bulk-copied |
| `mock-test-proxy.stdout.log` | generated log/state | preserved; not bulk-copied |
| `mock-test-runtime-processes.json` | generated log/state | preserved; not bulk-copied |
| `patch-interview-foundation.py` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `phase3-live-check.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `PHASE3-LIVE-PHASE4-PLAN.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `phase3-live-results.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `phase4-audit-b5-client-tests.txt` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `phase4-audit-current-narrative-fixture.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `phase4-audit-evidence-planner-tests.txt` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `phase4-completion-audit-isolated-tests.txt` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `prepare-qwen17-runner.py` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `qwen16-transition-stop.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `qwen17-controlled-start.py` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `qwen17-help.stderr.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-help.stdout.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-list-devices.stderr.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-list-devices.stdout.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-manual-testing-baseline.md` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `qwen17-model.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-monitor.stderr.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-monitor.stdout.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-one-request-dispatched.lock` | generated log/state | preserved; not bulk-copied |
| `qwen17-proxy-8000.stderr.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-proxy-8000.stdout.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-proxy.stderr.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-proxy.stdout.log` | generated log/state | preserved; not bulk-copied |
| `qwen17-smoke-summary.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `qwen17-smoke.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `qwen17-startup-state.json` | generated log/state | preserved; not bulk-copied |
| `qwen17-verified-metadata.json` | historical report/fixture; not runtime | preserved; not bulk-copied |
| `safe-local-backend.cjs` | essential runtime/activation; consolidated | preserved; not bulk-copied |
| `summarize-qwen17-smoke.py` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `three-fixes-backend-process.json` | generated log/state | preserved; not bulk-copied |
| `three-fixes-backend.stderr.log` | generated log/state | preserved; not bulk-copied |
| `three-fixes-backend.stdout.log` | generated log/state | preserved; not bulk-copied |
| `three-fixes-proxy-process.json` | generated log/state | preserved; not bulk-copied |
| `three-fixes-proxy.stderr.log` | generated log/state | preserved; not bulk-copied |
| `three-fixes-proxy.stdout.log` | generated log/state | preserved; not bulk-copied |
| `verify-backend-chat-load.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `verify-backend-interview-acceptance-load.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `verify-backend-interview-load.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `verify-backend-three-fixes-load.cjs` | essential runtime/activation; consolidated | preserved; not bulk-copied |
| `verify-recovery-node-options.cjs` | development/test utility or historical one-shot; not runtime | preserved; not bulk-copied |
| `verify-three-fixes-proxy-runtime.py` | essential runtime/activation; consolidated | preserved; not bulk-copied |

External directories `*-before`, `*-dist`, prior qwen sessions, local-startup-logs and fixture result folders are historical experiments/generated artifacts; they remain outside production runtime and were not recursively copied. No private configuration was copied. Known local `.env` files are sensitive and preserved; only new placeholder templates were created.

## Repository hygiene

- Initial Git inventory: 21,860 tracked files, including **21,591 server/ml/venv files (~364.8 MiB)** and 2,191 binary-extension files, mainly in that environment. Largest tracked binaries were ~19.5 MiB, ~19.3 MiB and ~6.1 MiB.
- Ignore rules cannot remove already tracked files. No `git rm --cached`, staging, index reset, commit, clean or push was performed. Untracking this generated environment while preserving its disk files needs a separately reviewed action.
- New GGUF, private `.env`, local cloudflared config/credential JSON, logs, state and caches are ignored. The copied GGUF is not tracked/staged. No sensitive `.env` filename was tracked.
- A bounded heuristic scan of tracked source found no obvious database credential URI or private-key marker; values were not printed. Vendor virtual-environment contents and Git history were not exhaustively secret-scanned. This is not a claim that all history is secret-free.
- Existing model schemas and MongoDB records were not changed by this consolidation; older uncommitted model diffs remain intact. Historical performance/golden baselines were not rewritten to force passing tests.
- One AST-only test baseline previously required ignored node_modules/.cache; its exact unchanged function bodies were relocated into qwen-server/tests/fixtures, not production runtime. Optional old benchmark runners still require their historical snapshots; they are not current runtime or normal regression prerequisites.
