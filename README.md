# Stock Intelligence Pipeline

End-to-end quantitative data platform: automated ingestion → statistical feature engineering → LLM-powered research → production React dashboard.

## Demo

https://github.com/jhatch3/stock-pipe-line/raw/main/2026-03-29%2020-46-32.mp4

## Overview

A production-grade stock analytics system built on a medallion architecture (**raw → clean → features → AI**). Ingests multi-interval OHLCV and news data for 230+ tickers, computes 30+ rolling financial features per bar, and surfaces AI-generated research summaries through a FastAPI agent and a React dashboard with live charting.

## Tech Stack

| Layer | Technologies |
|---|---|
| **Data Ingestion** | Python, Yahoo Finance, Alpaca API, WebSockets |
| **Feature Engineering** | pandas, NumPy, SciPy, OLS regression |
| **Database** | PostgreSQL (Supabase), idempotent upserts |
| **AI / LLM** | OpenAI GPT-4o, LangSmith, Pydantic structured outputs |
| **API** | FastAPI, REST |
| **Frontend** | React, Recharts, Tailwind CSS, Vite |
| **Infrastructure** | Docker, Docker Compose |

## Key Features

**Data Engineering**
- Multi-interval ETL pipelines (1m / 30m / 1h / 1d) for 230+ tickers with conflict-aware upserts and replayable backfills
- Modular pipeline architecture: `price_24hr` → `news` → `features` → `ai_agent`, each independently schedulable
- Ticker universe driven by database — add/remove tickers without touching pipeline code

**Feature Engineering & Statistical Modeling**
- 30+ per-bar rolling features: Jensen's Alpha, Beta, Sharpe Ratio, Sortino Ratio, Information Ratio, VaR(95%), Max Drawdown, Skewness, Kurtosis
- Technical indicators: RSI(14), MACD(12,26,9), Bollinger Bands(20,2σ), VWAP, VIX overlay
- Fundamental metrics: P/E, P/B, P/S, EV/EBITDA, PEG, ROE, ROA, Debt/Equity, ICR
- Proper Jensen's Alpha: `α = (Rp − Rf) − β·(Rm − Rf)` annualized over 1,638 hourly periods


**AI Agent Layer**
- OpenAI GPT-4o with LangSmith prompt versioning and Pydantic structured outputs
- News-grounded per-ticker research summaries with source attribution stored to Supabase
- FastAPI server (`/analyze/{ticker}`) with ticker validation and DB persistence

**Frontend Dashboard**
- Adaptive interval charting: 1D (last session) → 1W/1M/3M/6M/1Y (daily) → 5Y/Max (Friday-sampled weekly)
- Overlay support: SMA 50, SMA 200, Bollinger Bands, VWAP with correct warmup windowing
- Sub-panels: Volume, RSI(14), MACD histogram
- Real-time sector peer ranking: RSI, Sharpe Ratio, Volatility, Max Drawdown

## Project Structure

```
stock-pipe-line/
├── pipelines/
│   ├── price_24hr.py        # 24hr OHLCV refresh for all tickers
│   ├── news.py              # Alpaca news ingestion pipeline
│   ├── features.py          # Daily incremental feature computation
│   └── ai_agent.py          # Batch AI analysis pipeline
├── data/
│   ├── stock_yf.py          # Yahoo Finance ingestion (pull/clean/store)
│   ├── stock_alpaca.py      # Alpaca ingestion
│   ├── news_alpaca.py       # Alpaca news fetch + clean
│   ├── features.py          # StockMetrics class + compute_features_df()
│   ├── pipeline_features_full.py  # Full-history feature backfill
│   └── ticker_list.py       # Static ticker fallback
├── agent/
│   ├── agent.py             # OpenAI agent with LangSmith + structured output
│   └── server.py            # FastAPI endpoint
├── db/
│   ├── commander.py         # Supabase abstraction (upsert, fetch, news, tickers)
│   └── runtime.py           # Client singleton
├── frontend/
│   └── src/
│       ├── components/PriceChart.jsx
│       ├── pages/TickerDetail.jsx
│       └── lib/indicators.js
└── docker-compose.yaml
```

## Database Schema (Medallion)

| Table | Layer | Description |
|---|---|---|
| `tickers` | Config | Universe: id, symbol, name, sector |
| `stock_raw_data_yf` | Raw | Raw JSON payload per fetch |
| `stock_clean_data_yf` | Clean | Typed OHLCV rows, deduped on (ticker, interval, timestamp) |
| `stock_features` | Features | 30+ computed features per bar |
| `clean_stock_news_data` | Clean | Normalized news articles |
| `stock_ai_analysis` | AI | GPT summaries with sources per ticker |

## Installation

### Requirements

- Python 3.10+
- Docker + Docker Compose
- Supabase project (hosted or local)
- API keys: Alpaca, OpenAI, LangSmith (optional)

### Setup

1. **Clone the repo**
   ```bash
   git clone <repository-url>
   cd stock-pipe-line
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Fill in:
   # SUPABASE_URL=
   # SUPABASE_SERVICE_ROLE_KEY=
   # ALPACA_API_KEY=
   # ALPACA_API_SECRET=
   # OPENAI_API_KEY=
   # LANGSMITH_API_KEY=
   ```

4. **Initialize database** — run `init_db.sql` in the Supabase SQL editor

## Usage

### Pipelines

```bash
# Fetch last 24hrs of price data
python -m pipelines.price_24hr --run --all

# Fetch latest news
python -m pipelines.news --run --all

# Compute features (incremental — last 24 bars)
python -m pipelines.features --run --all

# Full history feature backfill (run once)
python -m data.pipeline_features_full --run --all

# Generate AI summaries
python -m pipelines.ai_agent --run --all

# Single ticker
python -m pipelines.features --run AAPL
python -m pipelines.ai_agent --run AAPL
```

### AI Agent Server

```bash
uvicorn agent.server:app --reload --port 8000
# GET /analyze/AAPL
# GET /health
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

