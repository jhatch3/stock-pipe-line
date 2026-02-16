# Stock Pipeline - Data Pipeline For Stock Analysis

A robust, Docker-based data pipeline for collecting, processing, and analyzing stock market data.

## Overview

Stock Pipeline is a containerized ETL (Extract, Transform, Load) system designed to automate the collection and analysis of stock market data. Built with Python and Docker, it provides a scalable solution for financial data processing and analysis.

## Features

- **Containerized Architecture** - Fully dockerized for consistent deployment across environments
- **Automated Data Collection** - Scheduled data extraction from stock market sources
- **ETL Pipeline** - Complete Extract, Transform, Load workflow
- **Data Analysis** - Built-in analysis tools for stock performance metrics
- **Easy Setup** - Simple one-command deployment
- **Python-Based** - Leverages popular Python data science libraries

## Requirements

- **Docker** 
- **Docker Compose** 
- **Python 3.8+** 
- **pip** 

## Project Structure

```

```

## Installation & Setup

### Mac/Linux

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stock-pipeline
   ```

2. **Start Docker containers - Make Sure Docker is Running** 
   ```bash
   docker-compose up
   ```

3. **Run setup script** (in a new terminal)
   ```bash
   ./setup.sh
   ```

4. **Set .env variables** 
   ```
   OPEN_AI_KEY=...
   ```

### Windows

1. **Clone the repository**
   ```powershell
   git clone <repository-url>
   cd stock-pipeline
   ```

2. **Start Docker containers - Make Sure Docker is Running** 
   ```powershell
   docker-compose up
   ```

3. **Run setup script** (in a new PowerShell terminal)
   ```powershell
   .\setup.ps1
   ```

4. **Set .env variables** 
   ```
   OPEN_AI_KEY=...
   ```

## Usage

### Starting the Pipeline

```
```

This starts all services in detached mode.

### Stopping the Pipeline

```
```

### Viewing Logs

```
```

### Running Specific Analysis

```
```

## Configuration

Configuration files are located in the `config/` directory:

- `config.yml` - Main configuration file
- `.env` - Environment variables (API keys, credentials)


### Example Configuration

```yaml

```

## Data Sources

The pipeline uses Finnhub for all data sources:


## Development

### Local Development Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run tests:
   ```bash
   pytest tests/
   ```

### Running Without Docker

```
```


## Troubleshooting

### Docker Issues

**Problem:** `docker-compose up` fails
```bash
# Solution: Reset Docker
docker-compose down -v
docker system prune -a
docker-compose up --build
```

**Problem:** Permission denied errors
```bash
# Solution: Fix permissions
chmod +x setup.sh
sudo chown -R $USER:$USER data/ logs/
```


