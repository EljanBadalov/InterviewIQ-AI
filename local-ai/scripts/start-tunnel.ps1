param([switch]$AccessPolicyVerified)
. (Join-Path $PSScriptRoot 'common.ps1')
if (!$AccessPolicyVerified) { throw 'Verify the named tunnel and deny-by-default Cloudflare Access Service Auth policy first.' }
$config=Join-Path $ProjectRoot 'local-ai/config/cloudflared.yml'
if (!(Test-Path -LiteralPath $config)) { throw 'Create private cloudflared.yml from the deployment template first.' }
$text=Get-Content -LiteralPath $config -Raw
if ($text -match 'REPLACE_|example\.com|trycloudflare|quick-tunnel' -or $text -notmatch '(?m)^tunnel:\s*[0-9a-f-]{36}\s*$') {
  throw 'A configured named tunnel is required; quick tunnels are forbidden.'
}
if ($text -notmatch 'http://127\.0\.0\.1:8000' -or $text -match ':8080') { throw 'Tunnel may expose only the loopback proxy, never llama.cpp.' }
$settings=Get-LocalSettings
if (!$settings['QWEN_PROXY_API_KEY']) { throw 'Origin authentication is required.' }
$status=Invoke-RestMethod 'http://127.0.0.1:8000/runtime-status' -Headers @{Authorization='Bearer '+$settings['QWEN_PROXY_API_KEY']} -TimeoutSec 3
if (!$status.authenticationRequired -or !$status.modelStartupForbidden) { throw 'Protected no-auto-start proxy required.' }
$cloudflared=(Get-Command cloudflared -ErrorAction Stop).Source
Push-Location $ProjectRoot
try { & $cloudflared tunnel --config $config run }
finally { Pop-Location }
