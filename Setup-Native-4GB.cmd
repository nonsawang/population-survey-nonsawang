@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================================
echo  Windows Native Setup (RAM 4 GB Mode - No Docker Needed)
echo ================================================================
node scripts\setup-native-env.cjs
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
  echo.
  echo [ตรวจพบ PostgreSQL 16 บนไดรฟ์ C: กำลังเริ่มตั้งค่าฐานข้อมูล nonsawang...]
  node scripts\init-native-postgres.cjs
)
echo.
pause
