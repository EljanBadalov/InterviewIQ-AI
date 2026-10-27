. (Join-Path $PSScriptRoot 'common.ps1')
$states=Get-ChildItem (Join-Path $ProjectRoot 'local-ai/logs') -Filter 'qwen17-startup-state.json' -Recurse -ErrorAction SilentlyContinue
foreach ($file in $states) {
  $state=Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  if ($state.status -in @('starting','ready_observing','stable_monitoring')) {
    if (Get-Process -Id $state.monitorPID -ErrorAction SilentlyContinue) {
      Set-Content -LiteralPath (Join-Path $file.DirectoryName 'stop.request') -Value 'operator requested'
    }
  }
}
Write-Output 'Stop requested for controlled monitors. Use Ctrl+C in the proxy and tunnel terminals. No unrelated process is terminated.'
