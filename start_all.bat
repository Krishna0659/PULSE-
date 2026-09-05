@echo off
echo ==========================================
echo        Starting Pulse Full-Stack App
echo ==========================================

cd /d "%~dp0"

echo [1/3] Initializing database...
call backend\venv\Scripts\python.exe backend\init_db.py

echo [2/3] Starting backend microservices...
start "Pulse Backend Services" cmd /k "cd backend && venv\Scripts\python.exe run_all.py"

echo [3/3] Starting React frontend...
start "Pulse Frontend" cmd /k "cd frontend && npm start"

echo ==========================================
echo Pulse Application launched!
echo Backend Gateway: http://localhost:8000
echo Frontend Dashboard: http://localhost:3000
echo ==========================================
