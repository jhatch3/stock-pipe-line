"""
News Pipeline — fetches and stores news articles for all tickers from Alpaca.

Usage:
    python -m pipelines.news --run --all
    python -m pipelines.news --run AAPL MSFT
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from data.news_alpaca import get_raw_ticker_news_data, clean_news_data
from db.runtime import get_commander

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("pipeline_news")


def run_all():
    tickers = get_commander().get_tickers()
    logger.info("Running news pipeline for all %d tickers...", len(tickers))
    _run(tickers)


def run_one(ticker: str):
    logger.info("Running news pipeline for %s...", ticker)
    _run([ticker.upper()])


def _run(tickers: list[str]):
    commander = get_commander()
    ok = fail = 0
    for ticker in tickers:
        try:
            raw = get_raw_ticker_news_data(ticker)
            if raw:
                commander.store_raw_ticker_news(ticker, raw)
                cleaned = clean_news_data(raw)
                commander.store_clean_ticker_news(ticker, cleaned)
                logger.info("%s | Stored %d articles", ticker, len(cleaned))
            else:
                logger.warning("%s | No news found", ticker)
            ok += 1
        except Exception as exc:
            logger.error("%s | Failed: %s", ticker, exc)
            fail += 1
    logger.info("Done — %d succeeded, %d failed", ok, fail)


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or "--run" not in args:
        logger.warning("Usage:")
        logger.warning("  python -m pipelines.news --run --all")
        logger.warning("  python -m pipelines.news --run <TICKER> [<TICKER> ...]")
        sys.exit(1)

    run_args = [a for a in args if a != "--run"]
    if "--all" in run_args:
        run_all()
    elif run_args:
        for ticker in run_args:
            run_one(ticker)
    else:
        logger.error("No ticker specified after --run")
        sys.exit(1)
