@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "%~dp0scripts\install-fit-task.cjs"
if errorlevel 1 (echo Installation did not complete.) else (echo Check lan-runtime\auto.log for the first completed run.)
pause
