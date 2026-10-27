. (Join-Path $PSScriptRoot 'common.ps1')
Assert-FreePort 5000
$previous=[Environment]::GetEnvironmentVariable('NODE_OPTIONS')
Push-Location (Join-Path $ProjectRoot 'server')
try {
  $env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
  & node --require (Join-Path $ProjectRoot 'local-ai/launchers/verify-backend.cjs') (Join-Path $ProjectRoot 'local-ai/launchers/safe-local-backend.cjs')
} finally {
  if ($null -eq $previous) { Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue } else { $env:NODE_OPTIONS=$previous }
  Pop-Location
}
