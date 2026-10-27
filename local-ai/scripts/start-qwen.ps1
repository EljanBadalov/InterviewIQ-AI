. (Join-Path $PSScriptRoot 'common.ps1')
Assert-FreePort 8080
$python=(Get-Command python -ErrorAction Stop).Source
# Run interactively: Ctrl+C stops only the model owned by this monitor.
& $python -B -u (Join-Path $ProjectRoot 'local-ai/safety/qwen_monitor.py')
exit $LASTEXITCODE
