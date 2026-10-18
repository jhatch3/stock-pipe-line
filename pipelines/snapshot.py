"""
Snapshot Pipeline — builds one dashboard row per ticker in ticker_snapshot:
latest close, 1D/1W/1M % change, 30-day sparkline, and latest RSI/Sharpe/volatility.

Run after the price and features pipelines.

Usage:
    python -m pipelines.snapshot --run --all
    python -m pipelines.snapshot --run AAPL
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db.runtime import get_commander

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("pipeline_snapshot")

SNAPSHOT_TABLE = "ticker_snapshot"
SPARK_BARS     = 30
# Trading-day lookbacks for % change
LOOKBACK       = {"chg_1d": 1, "chg_1w": 5, "chg_1m": 21}


def _pct_change(closes: list[float], bars: int) -> float | None:
    if len(closes) <= bars or not closes[-1 - bars]:
        return None
    return closes[-1] / closes[-1 - bars] - 1


def build_row(ticker: str, commander) -> dict | None:
    ohlcv = commander.fetch_ohlcv(ticker, "1d", limit=SPARK_BARS)
    if ohlcv.empty:
        logger.warning("%s | No daily prices, skipping", ticker)
        return None
    closes = [float(c) for c in ohlcv["close"]]

    feat = (
        commander.client.table("stock_features")
        .select("rsi,sharpe_ratio,volatility")
        .eq("ticker", ticker).eq("interval", "1h")
        .order("timestamp", desc=True).limit(1)
        .execute().data
    )
    feat = feat[0] if feat else {}

    row = {
        "ticker":       ticker,
        "last_close":   closes[-1],
        "last_ts":      ohlcv.index[-1].isoformat(),
        "spark":        [round(c, 4) for c in closes],
        "rsi":          feat.get("rsi"),
        "sharpe_ratio": feat.get("sharpe_ratio"),
        "volatility":   feat.get("volatility"),
        "updated_at":   datetime.now(timezone.utc).isoformat(),
    }
    for key, bars in LOOKBACK.items():
        row[key] = _pct_change(closes, bars)
    return row


def _run(tickers: list[str]):
    commander = get_commander()
    rows = []
    for ticker in tickers:
        try:
            row = build_row(ticker, commander)
            if row:
                rows.append(row)
        except Exception as exc:
            logger.error("%s | Failed: %s", ticker, exc)
    n = commander.bulk_insert_dicts(SNAPSHOT_TABLE, rows, conflict_columns=["ticker"])
    logger.info("Done. Upserted %d snapshot rows", n)


def run_all():
    _run(get_commander().get_tickers())


def run_one(ticker: str):
    _run([ticker.upper()])


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or "--run" not in args:
        logger.warning("Usage:")
        logger.warning("  python -m pipelines.snapshot --run --all")
        logger.warning("  python -m pipelines.snapshot --run <TICKER>")
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
