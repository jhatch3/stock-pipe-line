"""
Full-history features pipeline — computes features for ALL available OHLCV rows
per ticker (not just the last 24 bars). Run this once to backfill stock_features.

After backfill, use pipeline_features.py for daily incremental updates.

Usage:
    python -m data.pipeline_features_full --run --all
    python -m data.pipeline_features_full --run AAPL
"""
from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db.runtime import get_commander
from data.ticker_list import TICKERS
from data.features import compute_features_df

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("pipeline_features_full")

commander      = get_commander()
FEATURES_TABLE = os.getenv("FEATURES_TABLE", "stock_features")
INTERVAL       = "1h"
BATCH_SIZE     = 200   # rows per upsert call to avoid request-size limits


# ---------------------------------------------------------------------------
# Market data — fetch maximum available history
# ---------------------------------------------------------------------------

def _fetch_benchmark() -> pd.DataFrame:
    """Fetch ^GSPC hourly close from yfinance (yfinance caps hourly at ~730 days).

    Must be hourly to match the hourly OHLCV stored in the DB. Using daily bars
    here would reindex to hourly via ffill, making ~85% of benchmark returns
    exactly 0 and inflating computed alpha to equal raw annualized stock return.
    """
    df = yf.download("^GSPC", period="max", interval="1h", progress=False, auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0].lower() for c in df.columns]
    else:
        df.columns = df.columns.str.lower()
    if df.index.tz is None:
        df.index = df.index.tz_localize(timezone.utc)
    else:
        df.index = df.index.tz_convert(timezone.utc)
    logger.info("Benchmark: %d hourly bars fetched (~730-day yfinance limit)", len(df))
    return df[["close"]]


def _fetch_vix() -> pd.Series:
    """Fetch ^VIX hourly close from yfinance (yfinance caps hourly at ~730 days).

    Must be hourly for the same reason as benchmark — daily bars reindexed to
    hourly produce near-zero variance, breaking beta/alpha computation.
    """
    df = yf.download("^VIX", period="max", interval="1h", progress=False, auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0].lower() for c in df.columns]
    else:
        df.columns = df.columns.str.lower()
    if df.index.tz is None:
        df.index = df.index.tz_localize(timezone.utc)
    else:
        df.index = df.index.tz_convert(timezone.utc)
    logger.info("VIX: %d hourly bars fetched (~730-day yfinance limit)", len(df))
    return df["close"].squeeze()


# ---------------------------------------------------------------------------
# Per-ticker helpers
# ---------------------------------------------------------------------------

def _fetch_info(ticker: str) -> dict:
    tk   = yf.Ticker(ticker)
    info = tk.info or {}
    try:
        inc      = tk.financials
        ebit     = inc.loc["EBIT"].iloc[0]             if "EBIT"              in inc.index else None
        interest = inc.loc["Interest Expense"].iloc[0] if "Interest Expense"  in inc.index else None
        if ebit is not None and interest and interest != 0:
            info["_icr"] = float(abs(ebit / interest))
    except Exception:
        pass
    return info


def _df_to_records(ticker: str, features_df: pd.DataFrame) -> List[dict]:
    computed_at = datetime.now(timezone.utc).isoformat()
    records = []
    for ts, row in features_df.iterrows():
        record: dict = {
            "ticker":      ticker,
            "interval":    INTERVAL,
            "timestamp":   ts.isoformat(),
            "computed_at": computed_at,
        }
        for col in features_df.columns:
            val = row[col]
            record[col] = None if pd.isna(val) else round(float(val), 8)
        records.append(record)
    return records


def _upsert_in_batches(records: List[dict], ticker: str) -> int:
    """Upsert records in chunks to stay within Supabase payload limits."""
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        commander.bulk_insert_dicts(
            FEATURES_TABLE,
            batch,
            conflict_columns=["ticker", "interval", "timestamp"],
            upsert=True,
        )
        total += len(batch)
        logger.info("%s | Upserted batch %d–%d (%d rows)", ticker, i + 1, i + len(batch), len(batch))
    return total


# ---------------------------------------------------------------------------
# Core orchestration
# ---------------------------------------------------------------------------

def process_ticker(
    ticker: str,
    benchmark_df: pd.DataFrame,
    vix_series: pd.Series,
) -> int:
    """Compute features for ALL available OHLCV rows and upsert."""
    # Fetch all rows (large limit)
    ohlcv_df = commander.fetch_ohlcv(ticker, INTERVAL, limit=10_000)

    if ohlcv_df.empty:
        logger.warning("%s | No OHLCV data in DB, skipping", ticker)
        return 0

    n = len(ohlcv_df)
    if n < 30:
        logger.warning("%s | Only %d rows — need ≥30 for indicators, skipping", ticker, n)
        return 0

    logger.info("%s | Computing features for %d bars", ticker, n)

    info        = _fetch_info(ticker)
    features_df = compute_features_df(ohlcv_df, benchmark_df, vix_series, info)

    # Drop rows where all indicator columns are NaN (warmup period)
    indicator_cols = [c for c in features_df.columns if c not in ("open", "high", "low", "close", "volume")]
    features_df    = features_df.dropna(subset=indicator_cols, how="all")

    records = _df_to_records(ticker, features_df)
    total   = _upsert_in_batches(records, ticker)
    logger.info("%s | Done — %d feature rows upserted", ticker, total)
    return total


def run_all():
    logger.info("=== Full-history features backfill ===")
    logger.info("Fetching benchmark/VIX (period=max)...")
    benchmark_df = _fetch_benchmark()
    vix_series   = _fetch_vix()

    logger.info("Processing %d tickers", len(TICKERS))
    grand_total = 0
    for ticker in TICKERS:
        try:
            grand_total += process_ticker(ticker, benchmark_df, vix_series)
        except Exception as exc:
            logger.error("%s | Failed: %s", ticker, exc, exc_info=True)

    logger.info("=== Backfill complete. Total rows upserted: %d ===", grand_total)


def run_one(ticker: str):
    logger.info("Fetching benchmark/VIX (period=max)...")
    benchmark_df = _fetch_benchmark()
    vix_series   = _fetch_vix()
    process_ticker(ticker.upper(), benchmark_df, vix_series)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or "--run" not in args:
        print(__doc__)
        sys.exit(1)

    if "--all" in args:
        run_all()
    else:
        idx = args.index("--run") + 1
        if idx < len(args):
            run_one(args[idx])
        else:
            logger.error("No ticker specified after --run")
            sys.exit(1)
