import subprocess
import os
import sys
import time
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

# Load environment variables from backend/.env
env_file = os.path.join(BASE_DIR, ".env")
load_dotenv(env_file)

env = os.environ.copy()
env["PYTHONPATH"] = f"{BASE_DIR};{os.path.join(BASE_DIR, 'common')}"

# Python executable in venv or current sys.executable
venv_python = os.path.join(BASE_DIR, "venv", "Scripts", "python.exe")
python_exe = venv_python if os.path.exists(venv_python) else sys.executable

services = [
    {"name": "gateway-svc", "port": "8000"},
    {"name": "auth-svc", "port": "8001"},
    {"name": "ingestion-svc", "port": "8002"},
    {"name": "feature-svc", "port": "8003"},
    {"name": "anomaly-svc", "port": "8004"},
    {"name": "explain-svc", "port": "8005"}
]

processes = []
print(f"[*] Starting {len(services)} Pulse backend services...")

for svc in services:
    svc_dir = os.path.join(BASE_DIR, svc["name"])
    stdout_log = open(os.path.join(LOGS_DIR, f"{svc['name']}.log"), "w", encoding="utf-8")
    stderr_log = open(os.path.join(LOGS_DIR, f"{svc['name']}_err.log"), "w", encoding="utf-8")

    cmd = [python_exe, "-m", "uvicorn", "main:app", "--port", svc["port"], "--host", "0.0.0.0"]
    print(f"  - Starting {svc['name']:<15} -> http://localhost:{svc['port']}")
    p = subprocess.Popen(cmd, env=env, cwd=svc_dir, stdout=stdout_log, stderr=stderr_log)
    processes.append(p)

print("\n[+] All backend services are running!")
print(f"  - API Gateway: http://localhost:8000")
print("Press Ctrl+C to terminate all services.\n")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n🛑 Shutting down backend services...")
    for p in processes:
        p.terminate()
    print("All backend services stopped.")
