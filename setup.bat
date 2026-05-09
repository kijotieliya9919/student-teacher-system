@echo off
cd /d "%~dp0"
title FORESTRY INSTITUTE - Setup
color 0A

echo =============================================
echo  FORESTRY TRAINING INSTITUTE OLMOTONYI
echo  Automated Setup Wizard
echo =============================================
echo.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Install Python 3 from https://python.org
    pause
    exit /b 1
)

:: Check if venv exists
if not exist "venv\Scripts\python.exe" (
    echo [1/4] Creating virtual environment...
    python -m venv venv
)

echo [1/4] Installing dependencies...
call venv\Scripts\python.exe -m pip install -q flask flask-cors python-dotenv requests gunicorn 2>nul
echo   Done!

echo [2/4] Opening Supabase SQL Editor...
echo.
echo   I need you to do ONE manual step (takes 30 seconds):
echo.
echo   1. A browser will open to Supabase SQL Editor
echo   2. Open the file: supabase_migration.sql (in Notepad)
echo   3. Copy ALL the text from that file
echo   4. Paste it into the browser SQL Editor
echo   5. Click RUN (or press Ctrl+Enter)
echo.
start https://supabase.com/dashboard/project/jajfahyuglhbftphsktk/sql/new
notepad supabase_migration.sql
echo.
echo   After you've pasted and run the SQL in your browser,
echo   press ENTER here to continue...
pause >nul

echo.
echo [3/4] Creating default accounts...
call venv\Scripts\python.exe seed_users.py
echo.

echo [4/4] Starting the application...
echo.
echo   Your app will open at: http://localhost:5000
echo   Press Ctrl+C to stop the server
echo.
echo   Login credentials:
echo   ----------------------------------------
echo   Admin:   admin@forestry.edu / Admin123!
echo   Teacher: teacher@forestry.edu / Teacher123!
echo   Student: student@forestry.edu / Student123!
echo   ----------------------------------------
echo.
start http://localhost:5000
call venv\Scripts\python.exe app.py

pause
