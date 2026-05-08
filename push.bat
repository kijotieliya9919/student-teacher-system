@echo off
cd /d "%~dp0"
echo Staging changes...
git add .
git status
echo.
set /p msg="Enter commit message: "
if "%msg%"=="" set msg=Update %date% %time%
git commit -m "%msg%"
echo Pushing to GitHub...
git push
echo.
echo Done! Press any key to exit.
pause >nul
