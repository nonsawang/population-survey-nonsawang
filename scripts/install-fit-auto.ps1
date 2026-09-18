param(
 [Parameter(Mandatory=$true)][ValidateSet('new_only','include_existing')][string]$Scope,
 [Parameter(Mandatory=$true)][string]$NodePath
)
$ErrorActionPreference = 'Stop'
$fitRoot = Split-Path $PSScriptRoot -Parent
$fitRuntime = Join-Path $fitRoot 'lan-runtime'
$fitNode = (Get-Command node -ErrorAction Stop).Source
$fitModules = (Resolve-Path -LiteralPath $NodePath).Path
$fitTaskName = 'Nonsawang-FIT-AutoImport'
if (Get-ScheduledTask -TaskName $fitTaskName -ErrorAction SilentlyContinue) { throw 'Task already exists. Inspect its configuration before replacing it.' }
New-Item -ItemType Directory -Path $fitRuntime -Force | Out-Null
$fitOptions = Join-Path $fitRuntime 'auto.json'
if (Test-Path -LiteralPath $fitOptions) { throw 'Configuration already exists. Preserve its original cutoff and retry state.' }
@{enabled=$true;scope=$Scope;startAt=[DateTime]::UtcNow.ToString('o');limit=1;node=$fitNode;nodePath=$fitModules} | ConvertTo-Json | Set-Content -LiteralPath $fitOptions -Encoding utf8
$fitScript = Join-Path $PSScriptRoot 'run-fit-auto.ps1'
$fitAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$fitScript`"" -WorkingDirectory $fitRoot
$fitTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$fitSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$fitPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
try {
 Register-ScheduledTask -TaskName $fitTaskName -Action $fitAction -Trigger $fitTrigger -Settings $fitSettings -Principal $fitPrincipal -Description 'Import approved prepared FIT visits over LAN; one per minute; no NDP claims.' | Out-Null
} catch {
 $fitDisabled = Get-Content -LiteralPath $fitOptions -Raw | ConvertFrom-Json
 $fitDisabled.enabled=$false
 $fitDisabled | ConvertTo-Json | Set-Content -LiteralPath $fitOptions -Encoding utf8
 throw
}
Get-ScheduledTask -TaskName $fitTaskName | Select-Object TaskName,State
