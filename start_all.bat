@echo off
echo ==========================================
echo        Starting Pulse Full-Stack App
echo ==========================================

cd /d "%~dp0"

echo [1/4] Starting local Redis via Docker (if available)...
docker run -d --name pulse-redis -p 6379:6379 --restart unless-stopped redis:alpine 2>NUL
if errorlevel 1 (
    echo [WARNING] Could not start local Redis via Docker. 
    echo           Please ensure you have configured a Cloud Redis URL ^(e.g. Upstash^) in backend\.env
    echo           or the application will experience rate-limiting and JWT errors.
    echo.
)

echo [2/4] Initializing database...
call backend\venv\Scripts\python.exe backend\init_db.py

echo [3/4] Starting backend microservices...
start "Pulse Backend Services" cmd /k "cd backend && venv\Scripts\python.exe run_all.py"

echo [4/4] Starting React frontend...
start "Pulse Frontend" cmd /k "cd frontend && npm start"

echo ==========================================
echo Pulse Application launched!
echo Backend Gateway: http://localhost:8000
echo Frontend Dashboard: http://localhost:3000
echo ==========================================
