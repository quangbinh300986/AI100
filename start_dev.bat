@echo off
chcp 65001 >nul
cls

echo ===================================================
echo             Battle100 Dev Startup Script
echo ===================================================
echo.

REM 0. Clean up potential port process residue (8100 and 3100)
echo * Checking and cleaning up ports 8100 and 3100...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8100') do (
    echo Found process %%a on port 8100, killing...
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3100') do (
    echo Found process %%a on port 3100, killing...
    taskkill /F /PID %%a 2>nul
)
echo Port cleanup completed.
echo.

REM 1. Start Battle100 Backend (FastAPI with uv)
echo [Step 1] Starting Battle100 Backend (FastAPI)...
start "battle100-backend" cmd /k "cd /d c:\APP\AI100\battle100\backend && title battle100-backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload"

REM Wait 5 seconds
echo Waiting for backend to initialize (5 seconds)...
timeout /t 10 /nobreak > nul
echo.

REM 2. Start Battle100 Frontend (React/Vite)
echo [Step 2] Starting Battle100 Frontend (Vite)...
start "battle100-frontend" cmd /k "cd /d c:\APP\AI100\battle100\frontend && title battle100-frontend && npm run dev"

echo.
echo ===================================================
echo     All startup commands sent successfully!
echo ===================================================
timeout /t 5
exit
