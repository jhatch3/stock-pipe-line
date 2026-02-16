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
AIRFLOW_UID=$(id -u)
OPENAI_API_KEY=...
EOF

echo "Setup complete. Now set your api keys !"
