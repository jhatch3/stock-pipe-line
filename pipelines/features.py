"""
Features Pipeline — reads OHLCV from stock_clean_data_yf, computes per-bar
features, and upserts to stock_features.

Run once daily to compute features for the last 24 hourly bars per ticker.

Usage:
    python -m pipelines.features --run --all
    python -m pipelines.features --run AAPL
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
from data.features import compute_features_df

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("pipeline_features")

commander = get_commander()

FEATURES_TABLE = os.getenv("FEATURES_TABLE", "stock_features")
INTERVAL       = "1h"
DAILY_BARS     = 24   # number of new hourly bars to upsert per run


# ---------------------------------------------------------------------------
# Shared market data (fetched once per run, reused for all tickers)
# ---------------------------------------------------------------------------

def _fetch_benchmark() -> pd.DataFrame:
    """Fetch ^GSPC hourly close prices for the last 60 days from yfinance."""
    df = yf.download("^GSPC", period="60d", interval="1h", progress=False, auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0].lower() for c in df.columns]
    else:
        df.columns = df.columns.str.lower()
    if df.index.tz is None:
        df.index = df.index.tz_localize(timezone.utc)
    else:
        df.index = df.index.tz_convert(timezone.utc)
    return df[["close"]]


def _fetch_vix() -> pd.Series:
    """Fetch ^VIX hourly close prices for the last 60 days from yfinance."""
    df = yf.download("^VIX", period="60d", interval="1h", progress=False, auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0].lower() for c in df.columns]
    else:
        df.columns = df.columns.str.lower()
    if df.index.tz is None:
        df.index = df.index.tz_localize(timezone.utc)
    else:
        df.index = df.index.tz_convert(timezone.utc)
    return df["close"].squeeze()


# ---------------------------------------------------------------------------
# Per-ticker helpers
# ---------------------------------------------------------------------------

def _fetch_info(ticker: str) -> dict:
    """Fetch yfinance fundamentals + interest coverage ratio for a ticker."""
    tk   = yf.Ticker(ticker)
    info = tk.info or {}

    # Interest coverage ratio (EBIT / Interest Expense) — not in .info
    try:
        inc      = tk.financials
        ebit     = inc.loc["EBIT"].iloc[0]             if "EBIT"              in inc.index else None
        interest = inc.loc["Interest Expense"].iloc[0] if "Interest Expense" in inc.index else None
        if ebit is not None and interest and interest != 0:
            info["_icr"] = float(abs(ebit / interest))
    except Exception:
        pass

    return info


def _df_to_records(ticker: str, features_df: pd.DataFrame) -> List[dict]:
    """Convert a features DataFrame to a list of dicts ready for Supabase."""
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
            if pd.isna(val):
                record[col] = None
            else:
                record[col] = round(float(val), 8)
        records.append(record)
    return records


# ---------------------------------------------------------------------------
# Core orchestration
# ---------------------------------------------------------------------------

def process_ticker(
    ticker: str,
    benchmark_df: pd.DataFrame,
    vix_series: pd.Series,
) -> int:
    """Compute features for the last DAILY_BARS hourly rows and upsert."""
    ohlcv_df = commander.fetch_ohlcv(ticker, INTERVAL)

    if ohlcv_df.empty:
        logger.warning("%s | No OHLCV data in DB, skipping", ticker)
        return 0

    if len(ohlcv_df) < 30:
        logger.warning("%s | Only %d rows in DB — need at least 30 for indicators, skipping",
                       ticker, len(ohlcv_df))
        return 0

    info        = _fetch_info(ticker)
    features_df = compute_features_df(ohlcv_df, benchmark_df, vix_series, info)
    new_rows    = features_df.tail(DAILY_BARS)
    records     = _df_to_records(ticker, new_rows)

    commander.bulk_insert_dicts(
        FEATURES_TABLE,
        records,
        conflict_columns=["ticker", "interval", "timestamp"],
        upsert=True,
    )
    logger.info("%s | Upserted %d feature rows", ticker, len(records))
    return len(records)


def run_all():
    logger.info("Fetching shared market data (^GSPC, ^VIX)...")
    benchmark_df = _fetch_benchmark()
    vix_series   = _fetch_vix()

    tickers = commander.get_tickers()
    logger.info("Running features pipeline for %d tickers", len(tickers))

    total = 0
    for ticker in tickers:
        try:
            total += process_ticker(ticker, benchmark_df, vix_series)
        except Exception as exc:
            logger.error("%s | Failed: %s", ticker, exc)

    logger.info("Done. Total rows upserted: %d", total)


def run_one(ticker: str):
    logger.info("Fetching shared market data (^GSPC, ^VIX)...")
    benchmark_df = _fetch_benchmark()
    vix_series   = _fetch_vix()
    process_ticker(ticker.upper(), benchmark_df, vix_series)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or "--run" not in args:
        logger.warning("Usage:")
        logger.warning("  python -m pipelines.features --run --all")
        logger.warning("  python -m pipelines.features --run <TICKER>")
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
