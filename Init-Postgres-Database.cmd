@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================================
echo  Initialize PostgreSQL 16 Database "nonsawang" (RAM 4 GB Mode)
echo ================================================================
node scripts\init-native-postgres.cjs
echo.
pause
