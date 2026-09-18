$ErrorActionPreference = 'Stop'
$fitRoot = Split-Path $PSScriptRoot -Parent
$fitRuntime = Join-Path $fitRoot 'lan-runtime'
$fitOptions = Join-Path $fitRuntime 'auto.json'
$fitConfig = Get-Content -LiteralPath $fitOptions -Raw | ConvertFrom-Json
if (-not $fitConfig.enabled) { exit 0 }
$env:NODE_PATH = $fitConfig.nodePath
$fitLog = Join-Path $fitRuntime 'auto.log'
if ((Test-Path -LiteralPath $fitLog) -and (Get-Item -LiteralPath $fitLog).Length -gt 1048576) {
 Move-Item -LiteralPath $fitLog -Destination (Join-Path $fitRuntime 'auto.previous.log') -Force
}
& $fitConfig.node (Join-Path $PSScriptRoot 'hosxp-fit-auto.cjs') "--options=$fitOptions" 2>&1 | Out-File -LiteralPath $fitLog -Append -Encoding utf8
exit $LASTEXITCODE
