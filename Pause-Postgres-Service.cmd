@echo off
chcp 65001 >nul
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo กำลังขอสิทธิ์ผู้ดูแลระบบ ^(Administrator^) เพื่อพักบริการ PostgreSQL 16...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ================================================================
echo  กำลังหยุดพักบริการ postgresql-x64-16 และตั้งเป็น Manual (ประหยัด RAM)
echo ================================================================
sc config postgresql-x64-16 start= demand
net stop postgresql-x64-16
echo.
echo [สำเร็จ] ปิดพักบริการ PostgreSQL 16 และตั้งค่าไม่ให้รันอัตโนมัติตอนเปิดเครื่องเรียบร้อยแล้ว
echo (ข้อมูลในฐานข้อมูล nonsawang ยังอยู่ครบทุกประการ)
echo.
pause
