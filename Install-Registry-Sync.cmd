@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-registry-auto.ps1"
if errorlevel 1 (
  echo Installation failed. Registry auto sync is not enabled.
) else (
  echo Installed: Nonsawang-Registry-Sync, every 30 minutes and at Windows logon.
)
pause
