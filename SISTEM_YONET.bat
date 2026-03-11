@echo off
echo ========================================
echo   Azure Coast Resort - Sistem Yonetimi
echo ========================================
echo.
echo [1] Durumu goster
echo [2] Yeniden basla (restart)
echo [3] Durdur
echo [4] Loglari goster
echo [5] Cikis
echo.
set /p choice="Seciminiz: "

if "%choice%"=="1" goto STATUS
if "%choice%"=="2" goto RESTART
if "%choice%"=="3" goto STOP
if "%choice%"=="4" goto LOGS
if "%choice%"=="5" goto EXIT

:STATUS
npx pm2 status
pause
goto END

:RESTART
npx pm2 restart all
echo Tum servisler yeniden baslatildi!
pause
goto END

:STOP
npx pm2 stop all
echo Tum servisler durduruldu.
pause
goto END

:LOGS
echo Hangi servis?
echo [1] Telegram Bot
echo [2] Dashboard
set /p logchoice="Seciminiz: "
if "%logchoice%"=="1" npx pm2 logs hotel-telegram-bot --lines 50
if "%logchoice%"=="2" npx pm2 logs hotel-dashboard --lines 50
pause
goto END

:EXIT
:END
