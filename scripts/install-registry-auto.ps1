$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues['*:ErrorAction'] = 'Stop'
$registryRoot = Split-Path $PSScriptRoot -Parent
$registryConfig = Join-Path $registryRoot 'lan-runtime\registry-auto.json'
$registryOptions = Get-Content -LiteralPath $registryConfig -Raw | ConvertFrom-Json
$registryTask = 'Nonsawang-Registry-Sync'
$registryNode = $registryOptions.node
if (-not (Test-Path -LiteralPath $registryNode)) { throw 'Node runtime not found' }
$registryAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wscript.exe" -Argument ('"{0}" "{1}" "{2}"' -f (Join-Path $PSScriptRoot 'fit-auto-hidden.vbs'), $registryNode, (Join-Path $PSScriptRoot 'registry-auto-launcher.cjs')) -WorkingDirectory $registryRoot
$registryTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30)
$registryLogin = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$registrySettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 25)
$registryPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $registryTask -Action $registryAction -Trigger @($registryTrigger,$registryLogin) -Settings $registrySettings -Principal $registryPrincipal -Description 'Sync verified HOSxP names to Supabase every 30 minutes; read-only HOSxP; no visits.' -Force | Out-Null
$registryInstalled = Get-ScheduledTask -TaskName $registryTask -ErrorAction Stop
if (-not $registryInstalled) { throw 'Scheduler registration could not be verified' }
$registryOptions.enabled = $true
$registryOptions | ConvertTo-Json | Set-Content -LiteralPath $registryConfig -Encoding utf8
Get-ScheduledTask -TaskName $registryTask | Select-Object TaskName,State
