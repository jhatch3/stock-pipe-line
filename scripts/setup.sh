#!/usr/bin/env bash
set -e

echo "Creating venv (.venv)..."
python3.11 -m venv .venv
source .venv/bin/activate

echo "Upgrading pip..."
python -m pip install --upgrade pip

echo "Installing requirements..."
pip install -r requirements.txt

echo "Creating folders..."
mkdir -p dags logs plugins config

echo "Creating .env file..."

cat <<EOF > .env
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


EOF

echo "Setup complete. Now set your api keys !"
