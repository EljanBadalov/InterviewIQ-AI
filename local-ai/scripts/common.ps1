$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
function Get-LocalSettings {
  $settings = @{}
  $file = Join-Path $ProjectRoot 'local-ai/.env'
  if (Test-Path -LiteralPath $file) {
    foreach ($line in Get-Content -LiteralPath $file) {
      if ($line.Trim() -and !$line.Trim().StartsWith('#')) {
        $pair=$line.Split('=',2)
        if ($pair.Length -ne 2) { throw 'Invalid local configuration' }
        $settings[$pair[0].Trim()]=$pair[1].Trim().Trim('"').Trim("'")
      }
    }
  }
  $token=[Environment]::GetEnvironmentVariable('QWEN_PROXY_API_KEY')
  if ($token) { $settings['QWEN_PROXY_API_KEY']=$token }
  return $settings
}
function Assert-FreePort([int]$Port) {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $Port is occupied; existing services will not be stopped."
  }
}
