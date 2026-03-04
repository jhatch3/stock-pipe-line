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
AIRFLOW_UID=...

DB_HOST = 'localhost'
AIRFLOW_IMAGE_NAME=apache/airflow:2.9.3
AIRFLOW_UID=1000

# API keys
ALPACA_API_KEY=
ALPACA_API_SECRET=

# Supabase 
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY =

# Supabase Postgres (preferred)
user=
password=
host=
port=
dbname=

# table names
RAW_TABLE = "raw_stock_data_yf"
CLEAN_TABLE = "clean_stock_data_yf"
DB_NAME =
DB_USER = 
DB_PASSWORD = 
DB_PORT = "5432"

# LangSmith
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=
OPENAI_API_KEY=

"@ | Set-Content -Encoding utf8 .env

Write-Host "Initializing The Database with Tables..."
python .\db\commander.py

Write-Host "Setup complete. Now set your api keys !"

