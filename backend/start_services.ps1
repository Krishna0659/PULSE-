$ErrorActionPreference = "Stop"
$services = @(
    @{ name = "gateway-svc"; port = 8000 },
    @{ name = "auth-svc"; port = 8001 },
    @{ name = "ingestion-svc"; port = 8002 },
    @{ name = "feature-svc"; port = 8003 },
    @{ name = "anomaly-svc"; port = 8004 },
    @{ name = "explain-svc"; port = 8005 }
)

Write-Host "Creating virtual environment..."
python -m venv venv
.\venv\Scripts\Activate.ps1

Write-Host "Installing dependencies..."
foreach ($svc in $services) {
    if (Test-Path "$($svc.name)\requirements.txt") {
        Write-Host "Installing requirements for $($svc.name)..."
        pip install -r "$($svc.name)\requirements.txt"
    }
}
# Install common if exists
if (Test-Path "common\requirements.txt") {
    pip install -r common\requirements.txt
}

$env:PYTHONPATH="$((Get-Location).Path);$((Get-Location).Path)\common"

Write-Host "Starting services in background..."
foreach ($svc in $services) {
    Write-Host "Starting $($svc.name) on port $($svc.port)..."
    Start-Process -NoNewWindow -FilePath ".\venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "$($svc.name).main:app", "--port", "$($svc.port)", "--host", "127.0.0.1", "--env-file", ".env" -RedirectStandardOutput "logs_$($svc.name).txt" -RedirectStandardError "logs_$($svc.name)_err.txt"
}

Write-Host "All services started."
