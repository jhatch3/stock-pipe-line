"""
Price 24hr Pipeline — fetches the last 24 hours of OHLCV data for all tickers.

Usage:
    python -m pipelines.price_24hr --run --all
    python -m pipelines.price_24hr --run AAPL
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from data.stock_yf import refill_all_tickers, refill_one_ticker
from db.runtime import get_commander

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("pipeline_price_24hr")

LOOK_BACK_DAYS = 1  # 24 hours


def run_all():
    tickers = get_commander().get_tickers()
    logger.info("Running 24hr price pipeline for %d tickers...", len(tickers))
    for ticker in tickers:
        try:
            refill_one_ticker(ticker, look_back_amount=LOOK_BACK_DAYS)
        except Exception as exc:
            logger.error("%s | Failed: %s", ticker, exc)
    logger.info("Done.")


def run_one(ticker: str):
    logger.info("Running 24hr price pipeline for %s...", ticker)
    refill_one_ticker(ticker.upper(), look_back_amount=LOOK_BACK_DAYS)
    logger.info("Done.")


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or "--run" not in args:
        logger.warning("Usage:")
        logger.warning("  python -m pipelines.price_24hr --run --all")
        logger.warning("  python -m pipelines.price_24hr --run <TICKER>")
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
