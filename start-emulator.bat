@echo off
setlocal

rem Boots the Android emulator and bridges it to the local game server, so the
rem app can be tested on this laptop without a phone.
rem
rem The emulator reaches the server through "adb reverse", which forwards the
rem phone's localhost:8090 back to this machine -- so the app finds the server
rem on 127.0.0.1 without caring what the laptop's Wi-Fi address is.

set "SDK=D:\dev\android-sdk"
set "ANDROID_HOME=%SDK%"
set "ANDROID_SDK_ROOT=%SDK%"
set "ANDROID_AVD_HOME=D:\dev\avd"
set "AVD=GrandCanvas"

if not exist "%SDK%\emulator\emulator.exe" goto :no_sdk

echo Starting the %AVD% emulator...
start "" "%SDK%\emulator\emulator.exe" -avd %AVD% -gpu host -no-boot-anim

echo Waiting for it to boot ^(about 90 seconds the first time^)...
"%SDK%\platform-tools\adb.exe" wait-for-device
:wait_boot
for /f "usebackq delims=" %%b in (`"%SDK%\platform-tools\adb.exe" shell getprop sys.boot_completed 2^>nul`) do set "BOOTED=%%b"
if not "%BOOTED%"=="1" (
    timeout /t 3 /nobreak >nul
    goto wait_boot
)

rem Point the emulator's localhost:8090 at this machine's server.
"%SDK%\platform-tools\adb.exe" reverse tcp:8090 tcp:8090 >nul

echo.
echo ==================================================
echo  Emulator ready.
echo.
echo  Port 8090 is bridged, so start the server too:
echo      start-server.bat
echo.
echo  Then install the app with either:
echo      adb install -r TheGrandCanvas.apk
echo  or, for live reload while editing code:
echo      cd app ^&^& flutter run -d emulator-5554
echo ==================================================
echo.
goto :eof

:no_sdk
echo ERROR: Android SDK not found at %SDK%.
echo Edit the SDK path near the top of this script.
pause
exit /b 1
