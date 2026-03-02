"""
Yahoo Finance ingestion with a four-step pipeline:
1) raw = pull_data()          # ingestion only
2) store_raw(raw)             # write ASAP (source of truth / replay)
3) clean = clean(raw)         # deterministic transform
4) store_clean(clean)         # curated layer
"""
from __future__ import annotations

from datetime import datetime, date, timezone
from typing import Iterable, List, Dict, Any
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf
import sys
from pathlib import Path
import json
import logging
import dotenv, os 

from db.runtime import get_commander

    
commander = get_commander() 

try:
    from data.ticker_list import TICKERS  # when run as script
except ImportError:
    from .ticker_list import TICKERS      # when imported as package

dotenv.load_dotenv()

RAW_TABLE = os.getenv("RAW_TABLE", "stock_raw_data_yf")
CLEAN_TABLE = os.getenv("CLEAN_TABLE", "stock_clean_data_yf")
TICKER_LIMIT = int(os.getenv("YF_TICKER_LIMIT", "0"))  # 0 = no limit

# --- Config -----------------------------------------------------------------
_tables_ready = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("stock_yf")



# --- Helpers ----------------------------------------------------------------
def _fmt_pacific(ts: datetime) -> str:
    """Return timestamp in America/Los_Angeles with offset suffix, e.g. 2024-12-31 16:03:00-08."""
    local = ts.astimezone(ZoneInfo("America/Los_Angeles"))
    offset = int(local.utcoffset().total_seconds() // 3600)
    return local.strftime("%Y-%m-%d %H:%M:%S") + f"{offset:+03d}"


def _serialize_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    return value


def _serialize_rows(rows):
    return [_serialize_value(r) for r in rows]


def _ensure_tables() -> None:
    """
    Supabase schema must be created ahead of time. This helper is kept for
    backward compatibility and simply logs once.
    """
    global _tables_ready
    if _tables_ready:
        return
    logger.info(
        "Supabase mode: expecting existing tables %s and %s; no DDL executed.",
        RAW_TABLE,
        CLEAN_TABLE,
    )
    _tables_ready = True


# --- Pipeline steps ---------------------------------------------------------
def pull_data(ticker: str, interval: str = "1d") -> pd.DataFrame:
    """Fetch full available history for a ticker from Yahoo Finance."""
    df = yf.download(
        tickers=ticker,
        period="max",
        interval=interval,
        auto_adjust=False,
        progress=False,
        prepost=False,
        threads=False,
    )

    logger.info("%s |  Interval : %s | Step 1 | Task: Pulled Raw Data | %d bars", ticker, interval, len(df))

    return df


def store_raw(ticker: str, raw_df: pd.DataFrame, interval: str) -> None:
    # Flatten MultiIndex for consistent JSON serialization
    if isinstance(raw_df.columns, pd.MultiIndex):
        raw_df = raw_df.copy()
        raw_df.columns = [c[0] if isinstance(c, tuple) else c for c in raw_df.columns]

    # Normalize timestamps to UTC and build row dicts (not cleaned/filtered, just typed)
    if raw_df.index.tz is None:
        raw_df.index = raw_df.index.tz_localize(timezone.utc)
    else:
        raw_df.index = raw_df.index.tz_convert(timezone.utc)

    raw_df = raw_df.rename(columns=str.lower).reset_index()
    raw_df = raw_df.rename(columns={raw_df.columns[0]: "timestamp"})

    rows = []
    fetched_at = datetime.now(timezone.utc)
    for row in raw_df.itertuples(index=False):
        rows.append({
            "symbol": ticker,
            "timestamp": row.timestamp,   
            "open": (row.open),
            "high": (row.high),
            "low": (row.low),
            "close": (row.close),
            "volume": (row.volume),
            "last_updated": fetched_at,   
            "interval": interval,
        })

    payload = json.dumps(rows, default=str)
    record = {
        "symbol": ticker,
        "payload": payload,
        "interval": interval,
        "last_updated": datetime.now(timezone.utc),
    }
    commander.bulk_insert_dicts(
        RAW_TABLE, _serialize_rows([record]), conflict_columns=None, upsert=False
    )
    logger.info("%s |  Interval : %s | Step 2 | Task: Stored Raw Data | %d rows", ticker, interval, len(rows))


def clean(ticker: str, raw_df: pd.DataFrame, interval: str):
    if raw_df.empty:
        return []

    if isinstance(raw_df.columns, pd.MultiIndex):
        raw_df = raw_df.copy()
        raw_df.columns = [c[0] if isinstance(c, tuple) else c for c in raw_df.columns]

    # yfinance index usually tz-naive; treat as UTC
    if raw_df.index.tz is None:
        raw_df.index = raw_df.index.tz_localize(timezone.utc)
    else:
        raw_df.index = raw_df.index.tz_convert(timezone.utc)

    # de-dupe just in case (safe guard)
    raw_df = raw_df[~raw_df.index.duplicated(keep="last")]

    raw_df = raw_df.rename(columns=str.lower).reset_index()
    raw_df = raw_df.rename(columns={raw_df.columns[0]: "timestamp"})

    fetched_at = datetime.now(timezone.utc)

    rows = []
    for row in raw_df.itertuples(index=False):
        rows.append({
            "symbol": ticker,
            "interval": interval,
            "timestamp": row.timestamp,     # datetime w/ tz
            "open": float(row.open),
            "high": float(row.high),
            "low": float(row.low),
            "close": float(row.close),
            "volume": int(row.volume),
            "last_updated": fetched_at,     # datetime w/ tz
        })

    logger.info("%s |  Interval : %s | Step 3 | Task: Cleaned Data | %d clean rows", ticker, interval, len(rows))
    return rows


def store_clean(ticker: str, cleaned: Iterable[Dict[str, Any]]) -> None:
    """Persist curated layer to DB with upsert on (symbol, timestamp)."""
    cleaned_list = list(cleaned)
    if not cleaned_list:
        logger.info("No clean rows to upsert for %s", ticker)
        return
    logger.info(
        "%s | Interval: %s | Step 3.5 | Store Cleaned Data | %d clean rows",
        ticker,
        cleaned_list[0]["interval"],
        len(cleaned_list),
    )

    commander.bulk_insert_dicts(
        CLEAN_TABLE,
        _serialize_rows(cleaned_list),
        conflict_columns=["symbol", "interval", "timestamp"],
        upsert=True,
    )
    logger.info(
        "%s | Interval: %s | Step 4 | Stored Cleaned Data | Upserted %d rows",
        ticker,
        cleaned_list[0]["interval"],
        len(cleaned_list),
    )


# --- Orchestrator (keeps legacy signature) ----------------------------------
def process_stock_data(
    ticker: str,
    start_date=None,  # ignored for max history
    end_date=None,    # ignored for max history
    interval: str = "1d",
):
    raw_df = pull_data(ticker, interval=interval)
    store_raw(ticker, raw_df, interval)
    cleaned = clean(ticker, raw_df, interval)
    store_clean(ticker, cleaned)
    return cleaned


def populate_all_tickers():
    _ensure_tables()
    logger.info("Populating all the Historical Data for Each Ticker: %d total", len(TICKERS))
    for ticker in TICKERS:
        logger.info("Processing %s's Historical data", ticker)
        process_stock_data(ticker, interval="1d")
        process_stock_data(ticker, interval="1h")
        process_stock_data(ticker, interval="30m")
        process_stock_data(ticker, interval="1m")

def populate_one_ticker(ticker: str):
    _ensure_tables()
    logger.info("Populating the Historical Data for Ticker: %s", ticker)
    process_stock_data(ticker, interval="1d")
    process_stock_data(ticker, interval="1h")
    process_stock_data(ticker, interval="30m")
    process_stock_data(ticker, interval="1m")


def refill_all_tickers(look_back_amount: int = 3):
    """Refill all tickers with historical data for the last `look_back_amount` days."""
    if look_back_amount <= 0:
        logger.warning("look_back_amount must be positive. No refill performed.")
        return
    
    start_day = datetime.now(timezone.utc) - pd.Timedelta(days=look_back_amount)
    end_day = datetime.now(timezone.utc)
    
    _ensure_tables()
    logger.info("Populating all the Historical Data for Each Ticker: %d total", len(TICKERS))
    for ticker in TICKERS:
        logger.info("Processing %s | Start: %s | End: %s", ticker, start_day, end_day)
        process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="1d")
        process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="1h")
        process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="30m")
        process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="1m")

def refill_one_ticker(ticker: str, look_back_amount: int = 3):
    """Refill a single ticker with historical data for the last `look_back_amount` days."""
    if look_back_amount <= 0:
        logger.warning("look_back_amount must be positive. No refill performed.")
        return
    
    start_day = datetime.now(timezone.utc) - pd.Timedelta(days=look_back_amount)
    end_day = datetime.now(timezone.utc)
    
    _ensure_tables()
    logger.info("Refilling the Historical Data for Ticker: %s | Start: %s | End: %s", ticker, start_day, end_day)
    process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="1d")
    process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="1h")
    process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="30m")
    process_stock_data(ticker, start_date=start_day, end_date=end_day, interval="1m")

if __name__ == "__main__":
    time_before = datetime.now(timezone.utc)
    logger.info("Starting Yahoo Finance ingestion at %s", time_before.isoformat())
    #commander.delete_all_tables()
    tables_ready = False

    # ==== Uncomment one of the following lines to either populate all tickers or refill the last 3 days of data for all tickers ====
    # Populate all tickers with full historical data (this may take a long time) -> When app is first loaded
    # refill_all_tickers(look_back_amount=3) -> Refill last 3 days of data for all tickers (this is faster) -> When app is already loaded

    #populate_all_tickers()
    #refill_one_ticker(ticker="AAPL", look_back_amount=50) 
    
    time_after = datetime.now(timezone.utc)
    logger.info("Finished Yahoo Finance ingestion at %s", time_after.isoformat())
    logger.info("Total time taken: %s minutes", (time_after - time_before).total_seconds() / 60.0)

    try:
        logger.info("Total rows in %s: %d", RAW_TABLE, commander.count_rows(RAW_TABLE))
        #logger.info("Total rows in %s: %d", CLEAN_TABLE, commander.count_rows(CLEAN_TABLE))
    except Exception as e:
        logger.warning("Could not fetch row counts: %s", e)
