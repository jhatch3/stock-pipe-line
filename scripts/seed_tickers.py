"""
Seed the `tickers` table (symbol, name, sector) from data/ticker_list.py,
looking up name and sector on Yahoo Finance.

Usage:
    python -m scripts.seed_tickers
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from data.ticker_list import TICKERS
from db.runtime import get_commander

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("seed_tickers")


def lookup(symbol: str) -> dict:
    try:
        info = yf.Ticker(symbol.replace(".", "-")).info or {}
    except Exception as exc:
        logger.warning("%s | info lookup failed: %s", symbol, exc)
        info = {}
    sector = info.get("sector") or ("ETF" if info.get("quoteType") == "ETF" else None)
    return {
        "symbol": symbol,
        "name":   info.get("longName") or info.get("shortName"),
        "sector": sector,
    }


def main():
    rows = []
    for i, symbol in enumerate(TICKERS, 1):
        row = lookup(symbol)
        logger.info("[%d/%d] %s | %s | %s", i, len(TICKERS), symbol, row["name"], row["sector"])
        rows.append(row)
    n = get_commander().bulk_insert_dicts("tickers", rows, conflict_columns=["symbol"])
    logger.info("Upserted %d tickers", n)


if __name__ == "__main__":
    main()
