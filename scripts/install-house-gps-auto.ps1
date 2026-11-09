$ErrorActionPreference = 'Stop'
$gpsRoot = Split-Path $PSScriptRoot -Parent
$gpsNode = (Get-Command node.exe -ErrorAction Stop).Source
$gpsUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$gpsAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wscript.exe" -Argument ('//B //NoLogo "{0}" "{1}" "{2}"' -f (Join-Path $PSScriptRoot 'fit-auto-hidden.vbs'), $gpsNode, (Join-Path $PSScriptRoot 'house-gps-auto.cjs')) -WorkingDirectory $gpsRoot
$gpsTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$gpsLogin = New-ScheduledTaskTrigger -AtLogOn -User $gpsUser
$gpsSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 12)
$gpsPrincipal = New-ScheduledTaskPrincipal -UserId $gpsUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Nonsawang-House-GPS-Send' -Action $gpsAction -Trigger @($gpsTrigger,$gpsLogin) -Settings $gpsSettings -Principal $gpsPrincipal -Description 'Send staff-approved GPS queues only; atomic claim, compare old HOSxP coordinates and write receipt.' -Force | Out-Null
Get-ScheduledTask -TaskName 'Nonsawang-House-GPS-Send' | Select-Object TaskName,State
