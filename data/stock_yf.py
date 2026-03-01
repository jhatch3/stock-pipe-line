"""
Yahoo Finance ingestion with a four-step pipeline:
1) raw = pull_data()          # ingestion only
2) store_raw(raw)             # write ASAP (source of truth / replay)
3) clean = clean(raw)         # deterministic transform
4) store_clean(clean)         # curated layer
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Dict, Any
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf
import sys
from pathlib import Path
import json
import logging

# Ensure project root on path so we can import db.commander when run as script
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db.commander import Commander
from ticker_list import TICKERS

# --- Config -----------------------------------------------------------------
RAW_TABLE = "stock_raw_data_yf"
CLEAN_TABLE = "stock_clean_data_yf"

commander = Commander()
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


def _ensure_tables():
    global _tables_ready
    if _tables_ready:
        return

    raw_cols = {
        "id": "SERIAL PRIMARY KEY",
        "symbol": "VARCHAR(10) NOT NULL",
        "payload": "JSONB NOT NULL",
        "interval": "VARCHAR(10) NOT NULL",
        "last_updated": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
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
    }

    commander.create_table(RAW_TABLE, raw_cols, if_not_exists=True)
    commander.create_table(CLEAN_TABLE, clean_cols, if_not_exists=True)

    commander.execute_query(
        f'DROP INDEX IF EXISTS {CLEAN_TABLE}_sym_int_ts_idx;',
        fetch=False
    )

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
    commander.bulk_insert_dicts(RAW_TABLE, [record], conflict_columns=None, upsert=False)
    logger.info("[Stored raw] - [Interval : %s] payload for %s (%d rows)", interval, ticker, len(rows))


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
    return rows


def store_clean(ticker: str, cleaned: Iterable[Dict[str, Any]]) -> None:
    """Persist curated layer to DB with upsert on (symbol, timestamp)."""
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
    start_date=None,  # ignored for max history
    end_date=None,    # ignored for max history
    interval: str = "1d",
):
    _ensure_tables()
    raw_df = pull_data(ticker, interval=interval)
    store_raw(ticker, raw_df, interval)
    cleaned = clean(ticker, raw_df, interval)
    store_clean(ticker, cleaned)
    return cleaned


if __name__ == "__main__":
    commander.delete_all_tables()
    _tables_ready = False  # reset to force fresh creation
    _ensure_tables()
    # Default to a small subset to keep runtime manageable; expand slice as needed.
    for t in TICKERS:

        data_one_d = process_stock_data(t, interval="1d")
        data_one_h = process_stock_data(t, interval="1h")
        data_thirty_m = process_stock_data(t, interval="30m")
        data_one_m = process_stock_data(t, interval="1m")

        # logger.info(
        #     "[Processing Stocks Done] - %s rows -> 1d: %d | 1h: %d | 30m: %d | 1m: %d",
        #     t, len(data_one_d), len(data_one_h), len(data_thirty_m), len(data_one_m)
        # )
