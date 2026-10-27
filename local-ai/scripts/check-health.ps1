. (Join-Path $PSScriptRoot 'common.ps1')
$settings=Get-LocalSettings
$headers=@{}
if ($settings['QWEN_PROXY_API_KEY']) { $headers.Authorization='Bearer '+$settings['QWEN_PROXY_API_KEY'] }
foreach ($path in @('/health','/runtime-status','/controlled-test-safety')) {
  try { Invoke-RestMethod ('http://127.0.0.1:8000'+$path) -Headers $headers -TimeoutSec 3 }
  catch { Write-Output "Proxy $path unavailable or unauthorized" }
}
try { Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 3 }
catch { Write-Output 'Model is not ready; no startup or inference was attempted.' }

& python -B (Join-Path $ProjectRoot 'local-ai/scripts/check-resources.py')
