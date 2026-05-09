@echo off
cd /d "%~dp0"
echo Seeding users into Supabase...
call venv\Scripts\python.exe seed_users.py
echo.
if %errorlevel% equ 0 (
    echo Done! Users created successfully.
) else (
    echo Check errors above.
)
pause
