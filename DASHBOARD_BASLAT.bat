@echo off
title Hotel Dashboard - Baslatiliyor...
color 0B

echo.
echo  ================================================
echo   HotelOZGUR - Yonetim Paneli Baslatiliyor...
echo  ================================================
echo.

:: Onceki islemleri temizle (port 3000 kullaniyorsa)
echo  [1/2] Port 3000 temizleniyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  [2/2] Dashboard sunucusu baslatiliyor...
echo.
echo  *** PANEL ADRESI: http://localhost:3000 ***
echo  *** AYARLAR    : http://localhost:3000/settings ***
echo.
echo  (Bu pencereyi kapatirsaniz panel durur!)
echo.

cd /d "%~dp0hotel-admin-dashboard"
npm run dev
