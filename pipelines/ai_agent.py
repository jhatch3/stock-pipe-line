"""
AI Agent Pipeline — generates and upserts GPT summaries for all tickers
into the stock_ai_analysis table.

Usage:
    python -m pipelines.ai_agent --run --all
    python -m pipelines.ai_agent --run AAPL MSFT NVDA

Windows Task Scheduler (weekly, every Monday 6am):
    schtasks /create /tn "StockIQ AI Refresh" /tr "python -m pipelines.ai_agent --run --all" /sc weekly /d MON /st 06:00 /sd 01/01/2025 /f

Linux/macOS cron (every Monday at 6am):
    0 6 * * 1 cd /path/to/stock-pipe-line && python -m pipelines.ai_agent --run --all >> logs/pipeline_ai.log 2>&1
"""
from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent.agent import Agent
from db.runtime import get_commander

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("pipeline_ai_agent")

AI_TABLE  = "stock_ai_analysis"
DELAY_SEC = 3  # pause between tickers to avoid rate limits


def run_ticker(ticker: str, commander) -> bool:
    """Generate and upsert AI analysis for one ticker. Returns True on success."""
    try:
        agent  = Agent(ticker=ticker)
        result = agent.run()
        commander.client.table(AI_TABLE).upsert(
            {
                "ticker":    result["ticker"],
                "as_of_utc": result["as_of_utc"],
                "summary":   result.get("summary"),
                "sources":   result.get("sources"),
            },
            on_conflict="ticker",
        ).execute()
        logger.info("✓ %s — analysis stored", ticker)
        return True
    except Exception as exc:
        logger.error("✗ %s — %s", ticker, exc)
        return False


def run_all():
    _run(get_commander().get_tickers())


def run_one(ticker: str):
    _run([ticker.upper()])


def _run(targets: list[str]):
    commander = get_commander()
    ok = fail = 0

    for i, ticker in enumerate(targets):
        success = run_ticker(ticker, commander)
        if success:
            ok += 1
        else:
            fail += 1

        # Rate-limit pause between tickers (skip after last one)
        if i < len(targets) - 1:
            time.sleep(DELAY_SEC)

    logger.info("Done — %d succeeded, %d failed", ok, fail)


if __name__ == "__main__":
    args = sys.argv[1:]
    dry_run = "--run" not in args

    if "--all" in args:
        targets = get_commander().get_tickers()
    else:
        targets = [t.upper() for t in args if not t.startswith("--")]

    if not targets:
        print("Usage: python -m pipelines.ai_agent [--run] [--all | TICKER [TICKER ...]]")
        print("  --run   actually call the API and write to Supabase (omit for dry-run)")
        print("  --all   process every ticker in data/ticker_list.py")
        sys.exit(1)

    logger.info("Targets: %d tickers%s", len(targets), " (dry-run)" if dry_run else "")

    if dry_run:
        for t in targets:
            print(f"  would process: {t}")
    else:
        _run(targets)
