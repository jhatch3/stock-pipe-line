"""
Alpaca stock ingestion with a four-step pipeline:
1) raw = pull_data()          # ingestion only
2) store_raw(raw)             # write ASAP (source of truth / replay)
3) clean = clean(raw)         # deterministic transform
4) store_clean(clean)         # curated layer
"""
from __future__ import annotations

import json
import os
from pprint import pprint
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Dict, Any

import pandas as pd
from dotenv import load_dotenv
from zoneinfo import ZoneInfo
import logging

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame

# Ensure project root on path for db import when run as script
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db.commander import Commander
from ticker_list import TICKERS

# --- Config -----------------------------------------------------------------
RAW_TABLE = "stock_raw_data_alpaca"
CLEAN_TABLE = "stock_clean_data_alpaca"

load_dotenv()
ALPACA_KEY = os.getenv("ALPACA_KEY")
ALPACA_SECRET = os.getenv("ALPACA_SECRET")

assert ALPACA_KEY, "ALPACA_KEY must be set in .env file"
assert ALPACA_SECRET, "ALPACA_SECRET must be set in .env file"

client = StockHistoricalDataClient(ALPACA_KEY, ALPACA_SECRET)
commander = Commander()
_tables_ready = False

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("stock_alpaca")


# --- Helpers ----------------------------------------------------------------
def _fmt_pacific(ts: datetime) -> str:
    """Return timestamp in America/Los_Angeles with offset suffix, e.g. 2024-12-31 16:03:00-08."""
    local = ts.astimezone(ZoneInfo("America/Los_Angeles"))
    offset = int(local.utcoffset().total_seconds() // 3600)
    return local.strftime("%Y-%m-%d %H:%M:%S") + f"{offset:+03d}"


def _ensure_tables():
    """Create raw and clean tables if missing."""
    global _tables_ready
    if _tables_ready:
        return

    raw_cols = {
        "id": "SERIAL PRIMARY KEY",
        "symbol": "VARCHAR(10) NOT NULL",
        "interval": "VARCHAR(10) NOT NULL",
        "payload": "JSONB NOT NULL",
        "last_updated": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
    }
    clean_cols = {
        "id": "SERIAL PRIMARY KEY",
        "symbol": "VARCHAR(10) NOT NULL",
        "interval": "VARCHAR(10) NOT NULL",
        "timestamp": "TIMESTAMPTZ NOT NULL",
        "open": "DECIMAL(12,4) NOT NULL",
        "high": "DECIMAL(12,4) NOT NULL",
        "low": "DECIMAL(12,4) NOT NULL",
        "close": "DECIMAL(12,4) NOT NULL",
        "volume": "BIGINT NOT NULL",
        "last_updated": "TIMESTAMPTZ NOT NULL",
        "UNIQUE (symbol, interval, timestamp)": "",
    }
    commander.create_table(RAW_TABLE, raw_cols, if_not_exists=True)
    commander.create_table(CLEAN_TABLE, clean_cols, if_not_exists=True)

    commander.execute_query(
        f'''
        CREATE UNIQUE INDEX IF NOT EXISTS {CLEAN_TABLE}_sym_int_ts_idx
        ON {CLEAN_TABLE} (symbol, interval, "timestamp");
        ''',
        fetch=False
    )

    _tables_ready = True
    logger.info("Ensured tables: %s (raw), %s (clean)", RAW_TABLE, CLEAN_TABLE)


# --- Pipeline steps ---------------------------------------------------------
def pull_data(
    ticker: str,
    start: datetime | None = None,
    end: datetime | None = None,
    interval: TimeFrame = TimeFrame.Day,
) -> Dict[str, Any]:
    """Fetch raw bar data for a single ticker from Alpaca."""
    req = StockBarsRequest(
        symbol_or_symbols=[ticker],
        timeframe=interval,
        start=start,
        end=end,
    )
    bars = client.get_stock_bars(req)
    return bars.model_dump()


def store_raw(ticker: str, raw: Dict[str, Any], interval: TimeFrame) -> None:
    """Persist raw JSON payload to DB."""
    record = {
        "symbol": ticker,
        "interval": interval.value if hasattr(interval, "value") else str(interval),
        "payload": json.dumps(raw, default=str),
        "last_updated": datetime.now(timezone.utc)
    }
    commander.bulk_insert_dicts(RAW_TABLE, [record], conflict_columns=None, upsert=False)
    logger.info("[Stored raw] - [Interval : %s] payload for %s", record["interval"], ticker)


def clean(ticker: str, raw: Dict[str, Any], interval: TimeFrame) -> List[Dict[str, Any]]:
    """Deterministic transform from raw Alpaca payload to flat dicts."""
    if not raw or "data" not in raw or ticker not in raw["data"]:
        return []

    cleaned: List[Dict[str, Any]] = []
    fetched_at = datetime.now(timezone.utc)

    for record in raw["data"][ticker]:
        ts = record.get("timestamp") or record.get("t")
        ts_parsed = pd.to_datetime(ts, utc=True).to_pydatetime()
        record_out = {
            "symbol": ticker,
            "interval": interval.value if hasattr(interval, "value") else str(interval),
            "timestamp": ts_parsed,
            "open": float(record["open"]),
            "high": float(record["high"]),
            "low": float(record["low"]),
            "close": float(record["close"]),
            "volume": int(record["volume"]),
            "last_updated": fetched_at,
        }
        cleaned.append(record_out)

    return cleaned


def store_clean(ticker: str, cleaned: Iterable[Dict[str, Any]]) -> None:
    """Persist curated layer to DB with upsert on (symbol, interval, timestamp)."""
    cleaned_list = list(cleaned)
    if not cleaned_list:
        logger.info("No clean rows to upsert for %s", ticker)
        return

    commander.bulk_insert_dicts(
        CLEAN_TABLE,
        cleaned_list,
        conflict_columns=["symbol", "interval", "timestamp"],
        upsert=True,
    )
    logger.info("[Store Clean] - [Interval : %s] Upserted %d clean rows for %s", cleaned_list[0]["interval"], len(cleaned_list), ticker)



# --- Orchestrator (keeps legacy signature) ----------------------------------
def process_stock_data(
    ticker: str,
    start_date: list[int] | tuple[int, int, int] | None = None,
    end_date: list[int] | tuple[int, int, int] | None = None,
    interval: TimeFrame = TimeFrame.Day,
):
    _ensure_tables()
    start_dt = (
        datetime(*start_date, tzinfo=timezone.utc) if start_date else None
    )
    end_dt = (
        datetime(*end_date, tzinfo=timezone.utc) if end_date else None
    )

    raw = pull_data(ticker, start=start_dt, end=end_dt, interval=interval)
    store_raw(ticker, raw, interval)    
    cleaned = clean(ticker, raw, interval)
    store_clean(ticker, cleaned)
    return cleaned


if __name__ == "__main__":
    commander.delete_all_tables() 
    _tables_ready = False
    _ensure_tables()
    for ticker in TICKERS[:20]:
        logger.info("Processing %s ...", ticker)
        today = datetime.now(timezone.utc)
        last_month = datetime(today.year, today.month - 1, today.day, tzinfo=timezone.utc)

        rows = process_stock_data(ticker, interval=TimeFrame.Hour, start_date=(last_month.year, last_month.month, last_month.day), end_date=(today.year, today.month, today.day))
        logger.info("%s: %d rows (1d)", ticker, len(rows))
