@echo off
echo ======================================================
echo   SMART PACKAGE LOCKER - RESTART BACKEND SERVER
echo ======================================================
echo.
echo Stopping any running Node.js backend processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo.
echo Starting backend server on port 5000...
cd /d "%~dp0"
node backend/server.js
pause
