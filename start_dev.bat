@echo off
cls

echo ===================================================
echo             Battle100 Dev Startup Script
echo ===================================================
echo.

REM 0. 清理可能残留的端口占用进程（8100 和 3100）
echo 正在检查并清理 8100 和 3100 端口占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8100') do (
    echo 发现 8100 端口相关进程 %%a，正在强制终止该进程...
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3100') do (
    echo 发现 3100 端口相关进程 %%a，正在强制终止该进程...
    taskkill /F /PID %%a 2>nul
)
echo 端口清理完毕。
echo.

REM 1. Start Battle100 Backend (FastAPI with uv)
echo Starting Battle100 Backend (FastAPI)...
start "battle100-后端服务" cmd /k "cd /d c:\APP\AI100\battle100\backend && title battle100-后端服务 && uv run uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload"

REM Wait 5 seconds
echo Waiting for backend to initialize (5s)...
timeout /t 5 /nobreak > nul
echo.

REM 2. Start Battle100 Frontend (React/Vite)
echo Starting Battle100 Frontend (Vite)...
start "battle100-frontend" cmd /k "cd /d c:\APP\AI100\battle100\frontend && title battle100-frontend && npm run dev"

echo.
echo ===================================================
echo     All startup commands sent successfully!
echo ===================================================
timeout /t 5
exit
