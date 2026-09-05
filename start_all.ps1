Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "       Starting Pulse Full-Stack App     " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

$RootPath = $PSScriptRoot
$BackendPath = Join-Path $RootPath "backend"
$FrontendPath = Join-Path $RootPath "frontend"

# Check if DB needs initialization
Write-Host "`n[1/3] Checking and applying database migrations..." -ForegroundColor Yellow
& "$BackendPath\venv\Scripts\python.exe" "$BackendPath\init_db.py"

# Start Backend Services
Write-Host "`n[2/3] Starting backend microservices..." -ForegroundColor Yellow
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; .\venv\Scripts\python.exe run_all.py" -PassThru

# Start Frontend
Write-Host "`n[3/3] Starting React frontend..." -ForegroundColor Yellow
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npm start" -PassThru

Write-Host "`nPulse Application is launching!" -ForegroundColor Green
Write-Host "Backend API Gateway: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend Dashboard : http://localhost:3000" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
