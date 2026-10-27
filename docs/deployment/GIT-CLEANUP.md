# Safe Git cleanup — 2026-10-27

## Completed index-only operation

- Branch: `main`; upstream: `origin/main`. Origin URL: `https://github.com/EljanBadalov/InterviewIQ-AI.git`. Other local branches were preserved.
- Only `git rm -r --cached -- server/ml/venv` was executed. No local deletion, clean/reset, history rewriting, commit, staging of source work, push, deployment or service control was performed.
- Tracked file count: **21,860 → 269**. Exactly **21,591 staged D entries**, all under `server/ml/venv/`. The 2,727,367 displayed deleted text lines are expected index-only deletions, not disk deletion.
- All 21,591 local venv files still exist with unchanged sizes and modification times. The local environment is environment-specific (its pyvenv.cfg references a previous machine); it was not rebuilt or altered.
- Tracking footprint reduction: **364.82 MiB**, including **133.50 MiB of native binaries (520 files)** and **109.77 MiB compiled bytecode**. This does not shrink `.git/objects` or remove historical blobs.
- Remaining tracked files total **84.21 MiB**. Largest files are legitimate question datasets, about 2.44 MiB each; none exceed 5 MiB.
- Required intent classifier dependencies remain tracked: intent_classifier.onnx (72,789 bytes), intent_model.pkl (82,871 bytes), vectorizer.pkl (29,482 bytes). ML app/train/predict/data/metadata are preserved. These small application dependencies were deliberately retained; Qwen GGUF weights are excluded.
- Hashes for all 269 non-venv tracked files and 914 pre-existing untracked files were compared before/after. Apart from the authorized .gitignore update, **no pre-existing work changed or disappeared**. New cleanup documentation is additional untracked work.

## Ignore/security checks

Added standard pytest/mypy/ruff, coverage, tsbuildinfo and temporary-output ignore rules. Existing rules already exclude venv, node_modules, Python caches, dist, GGUF, private .env, Cloudflare JSON/config, runtime logs/state. Public .env.example and required scripts/config remain eligible for Git.

The staged index contains only expected venv deletions: no added model, .env, Cloudflare credential or new secret content. A privacy-safe scan covered 429 tracked/candidate text files and compared existing server-private environment values without printing them; **no finding**. Git history and removed vendor payloads were not exhaustively secret-scanned. No history rewrite was performed or recommended automatically.

13 essential runtime/deployment paths were explicitly checked present and not ignored. Docker context excludes .env, venv, node_modules, docs/tests and GGUF. Existing client/vercel.json remains tracked; root render.yaml and new deployment/runtime files remain untracked until the operator reviews and stages them.

## Current Git state

- Staged: only 21,591 expected venv deletions.
- Unstaged: prior user source/config edits plus .gitignore cleanup rules.
- Untracked: consolidated scripts/config/tests/docs. No source changes were automatically staged.
- Index backup and per-file verification manifest: task workspace `git-cleanup-20261027/index.before`, `before.json`, `verification.json`, `security.json`. These are recovery evidence, not runtime dependencies or files to commit. Do not restore an old index over new user staging without review.

No TypeScript/Python application source was changed by this cleanup. Source/venv content verification and Git integrity checks were used instead of rerunning application tests unnecessarily. The latest consolidation results remain 499 backend / 41 frontend / 25 Python tests, but those are prior test results, not newly run tests for this index operation.

## Exact manual review and push commands

Run PowerShell in the project root. The following commands are instructions only; no commit/push was executed.

```powershell
Set-Location -LiteralPath 'C:\Users\Asus\OneDrive - Azerbaijan University LLC\Рабочий стол\InterviewIQ-AI'

git branch --show-current
if ((git branch --show-current) -ne 'main') { throw 'Unexpected branch: stop.' }
git remote -v
git status --short
git diff --cached --shortstat

# Every currently staged deletion must be inside the verified environment.
$unexpected = git diff --cached --diff-filter=D --name-only |
  Where-Object { $_ -notlike 'server/ml/venv/*' }
if ($unexpected) { throw 'Unexpected staged deletion: stop and review.' }

# Review application changes separately from expected venv removals.
git diff --stat
git diff -- .gitignore README.md client/src server/src qwen-server/app.py
Get-Content -LiteralPath docs/deployment/REVIEWED-STAGE-PATHS.txt
```

The reviewed list selects modified source/config and new runtime/deployment/tests. Historical experiment folders, logs and bulk snapshots are not blindly staged. Three existing contract JSON fixtures required by normal regression tests are included explicitly; historical benchmark runners may still require their optional old snapshots. This list is a reviewed snapshot, not a blanket authorization to stage future edits or secrets. Review again if files change.

```powershell
# Stage only the reviewed individual paths after inspecting their diffs.
$paths = @(Get-Content -LiteralPath docs/deployment/REVIEWED-STAGE-PATHS.txt)
foreach ($path in $paths) {
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing reviewed path: $path" }
  if ($path -match '(^|/)(venv|node_modules|__pycache__)/|\.gguf$|(^|/)\.env$|cloudflared\.yml$') {
    throw "Private/generated path: $path"
  }
  git check-ignore --quiet -- $path
  if ($LASTEXITCODE -eq 0) { throw "Ignored path must not be staged: $path" }
  if ($LASTEXITCODE -ne 1) { throw 'Ignore check failed.' }
}
for ($offset=0; $offset -lt $paths.Count; $offset+=40) {
  $end=[Math]::Min($offset+39,$paths.Count-1)
  git --literal-pathspecs add -- $paths[$offset..$end]
  if ($LASTEXITCODE -ne 0) { throw 'Staging failed: stop and review.' }
}

# Review actual staged source, including any later edits, before committing.
git diff --cached --shortstat
git diff --cached --name-status -- . ':(exclude)server/ml/venv/**'
git diff --cached --check
git diff --cached -- .gitignore README.md client server qwen-server local-ai deployment docs render.yaml ':(exclude)server/ml/venv/**'
```

Do not continue if any credential or unintended file appears. Do not use `git add .` or `git add -A` as a substitute for this review.

```powershell
# Refresh remote knowledge; this does not push or rewrite local work.
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed: stop.' }
git log --oneline --left-right origin/main...main
$behind = git rev-list --count main..origin/main
if ($LASTEXITCODE -ne 0) { throw 'Remote comparison failed.' }
if ([int]$behind -gt 0) { throw 'Remote main advanced: stop and resolve deliberately.' }
# If origin/main advanced/diverged, stop and resolve deliberately; never force push/reset.

# Only after you approve the staged diff and branch state:
git commit -m "Prepare hybrid deployment and preserve interview evaluation fixes"
if ($LASTEXITCODE -ne 0) { throw 'Commit failed: do not push.' }
git push origin main
```

No force option is required. A non-fast-forward rejection must be investigated, not bypassed. Remote state was not fetched during cleanup; existing upstream configuration was inspected locally. Old venv blobs remain in history; removing them from historical commits would be a separate high-impact operation requiring explicit approval.

## Remaining deployment gates

Git index hygiene is repaired. A manual push still requires reviewed source staging/commit and remote comparison. Actual Vercel/Render origins, service secrets, Atlas network rules, Cloudflare domain/tunnel/Access policy, tool installation and cloud runtime sizing remain to configure. No live deployment or real Mock Interview E2E success is claimed. Qwen RAM/resource gates remain unchanged.
