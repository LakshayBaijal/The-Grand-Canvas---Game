@echo off
setlocal

rem Windows counterpart to start-server.sh (macOS). Same server, same wire
rem protocol -- this just handles the two things that differ per machine:
rem which Node to run (this server needs 22.5+, for node:sqlite) and how to
rem find the LAN IP to show on screen.

set "SCRIPT_DIR=%~dp0"
set "SERVER_DIR=%SCRIPT_DIR%server"

rem Preferred install location for a modern Node on this machine. If it's not
rem here, the script falls back to whatever "node" already resolves to on PATH.
set "NODE24=D:\dev\node24"

if exist "%NODE24%\node.exe" set "PATH=%NODE24%;%PATH%"

where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
set "NODE_VER_NUM=%NODE_VER:~1%"
for /f "tokens=1 delims=." %%m in ("%NODE_VER_NUM%") do set "NODE_MAJOR=%%m"
if %NODE_MAJOR% LSS 22 goto :old_node

cd /d "%SERVER_DIR%" || goto :bad_dir

if not exist "node_modules" (
    echo Installing server dependencies ^(first run^)...
    call npm install
    if errorlevel 1 goto :install_failed
)

set "LOCALIP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%get-lan-ip.ps1"`) do set "LOCALIP=%%i"
if "%LOCALIP%"=="" set "LOCALIP=<no wifi found>"

echo.
echo ==================================================
echo  The Grand Canvas server starting (Windows)...
echo.
echo  On your phone (same Wi-Fi), open the app, tap
echo  'Server settings', and enter:
echo.
echo      %LOCALIP%:8090
echo.
echo  It's remembered after the first successful connect
echo  -- you only need to retype it when your Wi-Fi changes.
echo ==================================================
echo.

call npm run dev
goto :eof

:no_node
echo.
echo ERROR: no Node.js found on PATH, and %NODE24% doesn't exist either.
echo This server needs Node 22.5+ (it uses the built-in node:sqlite module).
echo Install it, or point NODE24 near the top of this script at wherever it lives.
echo.
pause
exit /b 1

:old_node
echo.
echo ERROR: Node %NODE_MAJOR% found, but this server needs Node 22.5+
echo (it uses the built-in node:sqlite module). Currently on PATH: %NODE_VER%
if exist "%NODE24%\node.exe" (
    echo %NODE24% exists but wasn't the version picked up -- check it isn't broken.
) else (
    echo Install a newer Node. This script auto-prefers %NODE24% if present.
)
echo.
pause
exit /b 1

:bad_dir
echo ERROR: couldn't find the server directory at "%SERVER_DIR%".
pause
exit /b 1

:install_failed
echo npm install failed -- see the output above for details.
pause
exit /b 1
