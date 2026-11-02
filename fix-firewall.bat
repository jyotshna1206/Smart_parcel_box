@echo off
echo ====================================================
echo   CONFIGURING WINDOWS FIREWALL FOR SMART LOCKER
echo ====================================================

netsh advfirewall firewall delete rule name="Smart Locker Port 5000" >nul 2>&1
netsh advfirewall firewall add rule name="Smart Locker Port 5000" dir=in action=allow protocol=TCP localport=5000 profile=any

powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private" >nul 2>&1

echo.
echo ====================================================
echo   DONE! Port 5000 is now OPEN for ESP32.
echo ====================================================
echo.
pause

