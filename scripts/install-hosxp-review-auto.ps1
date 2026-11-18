$ErrorActionPreference = 'Stop'
$reviewRoot = Split-Path $PSScriptRoot -Parent
$reviewNode = (Get-Command node.exe -ErrorAction Stop).Source
$reviewUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$reviewAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wscript.exe" -Argument ('//B //NoLogo "{0}" "{1}" "{2}"' -f (Join-Path $PSScriptRoot 'fit-auto-hidden.vbs'), $reviewNode, (Join-Path $PSScriptRoot 'hosxp-review-auto.cjs')) -WorkingDirectory $reviewRoot
$reviewTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$reviewLogin = New-ScheduledTaskTrigger -AtLogOn -User $reviewUser
$reviewSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 12)
$reviewPrincipal = New-ScheduledTaskPrincipal -UserId $reviewUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Nonsawang-Population-Review-Send' -Action $reviewAction -Trigger @($reviewTrigger,$reviewLogin) -Settings $reviewSettings -Principal $reviewPrincipal -Description 'Send staff-approved population review queues (house_regist_type_id, person_discharge_id); atomic claim, compare old HOSxP values and write receipt.' -Force | Out-Null
Get-ScheduledTask -TaskName 'Nonsawang-Population-Review-Send' | Select-Object TaskName,State
