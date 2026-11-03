@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =====================================================================
echo   กำลังเริ่มระบบสุขภาพโนนสว่าง (โหมด Windows Native ประหยัด RAM 4 GB)
echo   - Native PostgREST Gateway : http://127.0.0.1:54321/rest/v1/
echo   - Next.js Web Server       : http://0.0.0.0:3000 (จำกัด Heap 512 MB)
echo =====================================================================

if not exist "%~dp0local-stack\.env.native" (
  node "%~dp0scripts\setup-native-env.cjs"
)

start "Nonsawang-PostgREST-Gateway" /min node --max-old-space-size=128 "%~dp0scripts\native-local-gateway.cjs"
timeout /t 2 /nobreak >nul

set NODE_ENV=production
set NEXT_TELEMETRY_DISABLED=1
set NODE_OPTIONS=--max-old-space-size=512

node "%~dp0node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 3000
pause
