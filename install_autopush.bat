@echo off
cd /d "%~dp0"
echo Installing Auto-Push to run on Windows startup...
echo.

:: Create a scheduled task that runs at logon
schtasks /create /tn "StudentTeacherAutoPush" /tr "pythonw.exe %~dp0autopush.py" /sc onlogon /rl limited /f

if %errorlevel% equ 0 (
    echo Auto-Push installed successfully!
    echo Starting now...
    start /min pythonw.exe "%~dp0autopush.py"
    echo Auto-Push is now running in the background.
    echo It will check for changes every 60 seconds and push to GitHub automatically.
) else (
    echo Installation failed. Try running as Administrator.
    echo.    
)
pause
