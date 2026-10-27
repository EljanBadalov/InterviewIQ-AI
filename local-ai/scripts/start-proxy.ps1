param([switch]$LocalOnly)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-FreePort 8000
$python=(Get-Command python -ErrorAction Stop).Source
$argsList=@('-B','-u',(Join-Path $ProjectRoot 'qwen-server/run_proxy.py'))
if ($LocalOnly) { $argsList+='--local-only' }
& $python @argsList
exit $LASTEXITCODE
