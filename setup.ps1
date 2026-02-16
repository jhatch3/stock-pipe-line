# setup.ps1
$ErrorActionPreference = "Stop"

Write-Host "Creating venv (.venv)..."
py -3.11 -m venv .venv

.\.venv\Scripts\Activate.ps1

Write-Host "Upgrading pip..."
python -m pip install --upgrade pip

Write-Host "Installing requirements..."
pip install -r requirements.txt


@"
AIRFLOW_IMAGE_NAME=apache/airflow:2.9.3
AIRFLOW_UID=1000
OPENAI_API_KEY=...
"@ | Set-Content -Encoding utf8 .env

Write-Host "Initializing The Database with Tables..."
python .\db\commander.py

Write-Host "Setup complete. Now set your api keys !"

