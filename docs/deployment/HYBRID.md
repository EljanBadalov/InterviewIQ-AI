# Hybrid deployment preparation

Status: preparation only. No service was restarted, no tunnel/account/deployment was created, and no real AI/database mutation was run. Mock Interview `three-fixes-v1` is preserved. Real evaluation/persistence/UI progression remains unverified until an approved E2E test.

## Actual consolidated layout

```text
InterviewIQ-AI/
  client/                         React/Vite; existing vercel.json SPA rewrite
    .env.example
    tests/cloud-build.test.cjs
  server/                         Express/TypeScript, MongoDB Atlas
    Dockerfile                    Node 22 + ONNX locale + Playwright; non-root runtime
    .dockerignore
    .env.example
    src/config/aiProxyTransport.ts
    src/config/mongoSafety.ts
    tests/hybrid-deployment.test.cjs
  qwen-server/
    app.py                        existing contracts/diagnostics; no automatic model start
    local_runtime.py              canonical protected proxy + no-spawn guard
    run_proxy.py                  loopback-only entry point, lifespan off
    tests/fixtures/runtime_builders_before.py  AST-only compatibility fixture
  local-ai/
    .env.example                  private copy is local-ai/.env
    launchers/
      safe-local-backend.cjs
      verify-backend.cjs
      start-proxy.py              compatibility entry to canonical proxy
    safety/
      runtime_config.py           fixed validated profile, SHA checks, path resolver
      qwen_monitor.py             single model owner + continuous monitoring
    config/
      validated-profile.example.json
    scripts/
      common.ps1
      start-qwen.ps1
      start-proxy.ps1
      start-tunnel.ps1
      start-safe-backend.ps1
      check-health.ps1
      check-resources.py
      stop-local-ai.ps1
    models/Qwen3-1.7B-Q4_K_M.gguf  ignored; 1,282,439,264 bytes
    logs/                         unique UTC/UUID sessions, ignored
  deployment/
    cloudflare/config.example.yml
    render/README.md
    vercel/README.md
  docs/deployment/
    HYBRID.md
    CONSOLIDATION-AUDIT.md
    VALIDATION.md
  render.yaml
```

Node/Python/WinGet llama.cpp, GPU drivers and cloudflared are system prerequisites, not copied binaries. No model download is needed. All project-specific executable scripts resolve from this project root. Existing local `.env` files were preserved.

## Security architecture

Browser → Vercel → Render JWT-protected API → HTTPS named Cloudflare Tunnel with Access Service Auth → authenticated loopback proxy → loopback llama.cpp.

- Only Render holds `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` and `QWEN_PROXY_API_KEY`.
- Use the Access **Service Auth** action with the exact Render service token; deny everyone else. No bypass/everyone rule.
- Origin Bearer token (random ASCII, at least 32 characters) is a second guard. Use the same secret in Render and private `local-ai/.env`.
- The proxy authenticates before model readiness or inference, bounds request bodies to 1 MiB, accepts at most two generation requests in flight and twelve generation requests per minute. The existing inference lock still serializes one model request. No new retries.
- Only `/generate` and `/health` are routed through the tunnel. The final ingress rule is HTTP 404. Administrative/docs/status routes are not public.
- Backend rejects insecure cloud credential configuration and uses `redirect: error`; Access login redirects never receive followed credentials.
- `--local-only` is only for loopback development. The tunnel launcher refuses a proxy whose runtime reports authentication disabled.
- `-AccessPolicyVerified` is an operator acknowledgement, not cryptographic proof of account policy. The Access policy and external unauthorized-request behavior must be verified before publishing.
- Never use a public unauthenticated Quick Tunnel or router port forwarding. Never expose port 8080.

Official references: [Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/), [local tunnel configuration](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/).

## Configuration and deployment sequence — approval required before live actions

1. Review the tracked virtual environment finding in CONSOLIDATION-AUDIT.md. Do not blindly stage the repository. Removing these files from the Git index requires a separately reviewed change; disk originals must remain.
2. Select the real Vercel/Render origins, Cloudflare-owned domain/hostname, named tunnel UUID, Access service token, origin secret and Render plan. None was inferred or created here.
3. After approval, configure MongoDB Atlas network access for the Render service's actual outbound addresses and a least-privilege application user. Do not create indexes/migrations. Replica-set transactions are required for interview commits. No 0.0.0.0/0 allowlist change was performed.
4. Configure Render using root `render.yaml`: rootDir `server`, Docker context `.`, Dockerfile `./Dockerfile`. Its existing ONNX `en_US.UTF-8` locale was preserved. Docker build installs matching Chromium dependencies, compiles and prunes dev dependencies. Runtime binds `0.0.0.0:$PORT` as user `node`; the template requests up to 300 seconds for graceful shutdown. Interrupted remote inference still requires durable-state review.
5. Set all `sync: false` variables in Render. `CLIENT_URL` is the actual Vercel origin; `QWEN_SERVICE_URL` is the stable HTTPS AI hostname, with no `/generate` suffix. Set `QWEN_REQUIRE_SECURE_PROXY=true`, the Access pair, origin token and `ENABLE_STARTUP_RECOVERY=false`. Keep QWEN_DEBUG=false. Existing Google/EmailJS settings must be supplied, never copied into client variables. Do not use dummy example values.
6. Check Render `GET /health` and unauthenticated `GET /api/v1/interviews` (401) without AI. `/health` uses database connection readiness; it does not call Qwen. Normal startup explicitly disables Mongoose autoIndex/autoCreate. Recovery writes only run with explicit `ENABLE_STARTUP_RECOVERY=true`, which is not approved here.
7. Configure Vercel rootDir `client`, Node 22.x, `npm ci`, `npm run build`, output `dist`. Existing `client/vercel.json` handles refresh/deep links. Set public `VITE_API_URL=https://ACTUAL_RENDER_HOST/api/v1` and public `VITE_GOOGLE_CLIENT_ID`; configure Google authorized origins. The cloud build guard rejects localhost, credentials-in-URL and non-HTTPS API values. Local development/preview stays compatible.
8. Set private local configuration and a protected named Cloudflare tunnel as described below. Domain/DNS/Access/tunnel creation is a live account change and needs separate approval. Locally-managed credentials must be copied into the ignored `local-ai/config/` directory without printing or committing them. Keep any original account credential files untouched.
9. Only after cloud/local configuration is reviewed should live deployments/tunnel startup be approved. Verify unauthenticated external `/health` is rejected by Access and `/generate` cannot bypass both guards. Do not test generation until separately approved. Do not fetch `/generate` as a health check.

Render paths are relative to rootDir: [monorepo reference](https://render.com/docs/monorepo-support). Vite SPA behavior: [Vercel reference](https://vercel.com/docs/frameworks/frontend/vite).

## Local setup commands — not executed here

Open PowerShell in the project root. Use Python 3.12 and the existing verified WinGet Vulkan executable. Python package installation is a separate explicit operator action; no dependency installation was performed during this task.

```powershell
# Optional isolated Python environment; never commit it.
python -m venv qwen-server/.venv
qwen-server/.venv/Scripts/python.exe -m pip install -r qwen-server/requirements.txt

# Do not overwrite an existing private file.
if (!(Test-Path local-ai/.env)) { Copy-Item local-ai/.env.example local-ai/.env }
```

This project is under OneDrive: Git ignore rules do not prevent cloud synchronization. Prefer a private process environment or protect/exclude secret files from synchronization before adding real credentials. No real secret file was created here.

Edit `local-ai/.env` privately with the matching origin token. Do not paste secrets into chat, command history, screenshots or VITE variables. Use an absolute Python path or activate the isolated venv in each terminal before running scripts. Launchers use the current `python` executable; they do not install anything.

After approval and only when the fixed gates pass:

```powershell
# Terminal A: one model + monitor; foreground, no automatic restart.
.\local-ai\scripts\start-qwen.ps1

# Terminal B: protected proxy, never starts a model.
.\local-ai\scripts\start-proxy.ps1

# Separate terminal: GET-only, no startup or inference.
.\local-ai\scripts\check-health.ps1
```

If port 8000/8080 is already occupied, scripts refuse startup and leave the existing service alone. Do not run these against the currently running legacy processes without a separately approved ownership/shutdown transition.

For local-only development without a tunnel, `start-proxy.ps1 -LocalOnly` is available. A configured token still enables authentication and must meet the minimum length. Never tunnel the unauthenticated mode.

### Named Cloudflare tunnel

After account-change approval, create a named tunnel using the official [locally-managed setup](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/). Supply the resulting UUID/credential JSON privately. Login/create commands are account operations, not validation commands, and have not been run. Install cloudflared separately; none is currently available on PATH in this session.

```powershell
if (!(Test-Path local-ai/config/cloudflared.yml)) {
  Copy-Item deployment/cloudflare/config.example.yml local-ai/config/cloudflared.yml
}
# Edit hostname, UUID and credentials-file privately; configure Access Service Auth first.
# Validation does not create a tunnel or start inference:
cloudflared tunnel --config local-ai/config/cloudflared.yml ingress validate
cloudflared tunnel --config local-ai/config/cloudflared.yml ingress rule https://ACTUAL_AI_HOST/generate
cloudflared tunnel --config local-ai/config/cloudflared.yml ingress rule https://ACTUAL_AI_HOST/controlled-test-safety

# Only after approval, with Access verified and an authenticated local proxy:
.\local-ai\scripts\start-tunnel.ps1 -AccessPolicyVerified
```

The generation/health rule should match only those two paths; diagnostics should hit HTTP 404. Tunnel commands connect to Cloudflare and require separate authorization. No Windows login task, service installation, auto-start or automatic restart was created.

### Shutdown

```powershell
.\local-ai\scripts\stop-local-ai.ps1
```

This writes a stop request into each active owned monitor's session. The monitor terminates only its retained model handle. Use Ctrl+C in the proxy/tunnel terminals. No script kills processes by a broad name. If a monitor has crashed and left an orphan, investigate ownership first; there is no automatic orphan termination or model restart.

### Optional local backend

```powershell
.\local-ai\scripts\start-safe-backend.ps1
```

This refuses an occupied port, resolves project-relative paths, scopes NODE_OPTIONS so the esbuild worker inherits preserve-symlinks flags, and imports app directly with autoIndex/autoCreate/recovery disabled. It does not replace running services. Render uses compiled `dist/server.js`, not this development transpiler.

## Fixed model safety policy

- Model SHA256 `d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5`, exactly 1,282,439,264 bytes.
- Verified llama-server SHA256 `eba08aa1a6ad397e8954874ca58f62271cf15ab45a85d6f1f59176a47cabd6c2`.
- Vulkan1 RTX 3060 Laptop, gpu-layers=16, ctx=4096, parallel=1, threads=2/2, batch=128, ubatch=64, F16 K/V, fit off, Jinja, no warmup.
- Pre-start available RAM >=6.5 GiB, free VRAM >=3072 MiB and temperature <60°C.
- Post-load RAM >=3 GiB; emergency below 2.5 GiB; total VRAM abort >=4915 MiB; temperature abort >=min(75°C, baseline+15°C).
- Unique sessions prevent old state blocking new starts. A Windows mutex prevents competing controlled launchers; process/port checks remain. Integrity and resource gates cannot be disabled through .env.
- The monitor records resources, not an inference counter. Safety shutdown is final; no restart loop. Consolidated real startup/inference remains unverified.

## Deployment blockers and limits

- Docker and cloudflared are not on PATH here; Docker build/Cloudflare ingress CLI validation/live accounts are not verified.
- Domain, Access service token/policy, named tunnel credentials, Render plan, production origins and OAuth settings are missing.
- 21,591 virtual environment files (~364.8 MiB) are already tracked. Ignore rules do not untrack them. Git index/history was not rewritten.
- The existing Cloudflare read timeout is currently documented as 125 seconds by default. Mock Interview's 60-second budget fits that envelope, but existing longer synchronous Career Assistant/Roadmap requests can exceed it. No async/job/polling redesign was added. Do not claim these flows are fully cloud-compatible before measured tests. [Cloudflare 524 reference](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)
- Initial setup needs the local computer awake, connected and resource-safe. Synchronize Windows time: request deadlines cross Render/local machines using Unix time. Moving frontend/backend off the laptop may free some RAM but does not guarantee the 6.5 GiB gate; cloud hosting does not guarantee Qwen availability.
- Browser jobs may exceed low-memory Render plans; ONNX/Chromium Linux runtime still needs a real image smoke test.
- Only after cloud authentication, health, local monitor and separate submission approval may a real Mock Interview evaluation be tested. Passing fixtures alone is not E2E success.
