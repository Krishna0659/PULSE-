Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "       Starting Pulse Full-Stack App     " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

$RootPath = $PSScriptRoot
$BackendPath = Join-Path $RootPath "backend"
$FrontendPath = Join-Path $RootPath "frontend"

Write-Host "`n[1/4] Starting local Redis via Docker (if available)..." -ForegroundColor Yellow
$dockerProcess = Start-Process docker -ArgumentList "run", "-d", "--name", "pulse-redis", "-p", "6379:6379", "--restart", "unless-stopped", "redis:alpine" -NoNewWindow -Wait -PassThru
if ($dockerProcess.ExitCode -ne 0) {
    Write-Host "[WARNING] Could not start local Redis via Docker." -ForegroundColor Red
    Write-Host "          Please ensure you have configured a Cloud Redis URL (e.g. Upstash) in backend\.env" -ForegroundColor Red
    Write-Host "          or the application will experience rate-limiting and JWT errors." -ForegroundColor Red
}

# Check if DB needs initialization
Write-Host "`n[2/4] Checking and applying database migrations..." -ForegroundColor Yellow
& "$BackendPath\venv\Scripts\python.exe" "$BackendPath\init_db.py"

# Start Backend Services
Write-Host "`n[3/4] Starting backend microservices..." -ForegroundColor Yellow
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; .\venv\Scripts\python.exe run_all.py" -PassThru

# Start Frontend
Write-Host "`n[4/4] Starting React frontend..." -ForegroundColor Yellow
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendPath'; npm start" -PassThru

Write-Host "`nPulse Application is launching!" -ForegroundColor Green
Write-Host "Backend API Gateway: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend Dashboard : http://localhost:3000" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
