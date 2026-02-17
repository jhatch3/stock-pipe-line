from dotenv import load_dotenv
import os
from datetime import datetime, timezone

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from time import sleep 

from ticker_list import TICKERS 

load_dotenv()
ALPACA_KEY = os.getenv("ALPACA_KEY")
ALPACA_SECRET = os.getenv("ALPACA_SECRET")

assert ALPACA_KEY, "ALPACA_KEY must be set in .env file"
assert ALPACA_SECRET, "ALPACA_SECRET must be set in .env file"

client = StockHistoricalDataClient(ALPACA_KEY, ALPACA_SECRET)

def get_raw_stock_data(
    tickers: list[str],
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    interval: TimeFrame = TimeFrame.Hour,
):
    req = StockBarsRequest(
        symbol_or_symbols=tickers,
        timeframe=interval,
        start=start_date,
        end=end_date,
    )
    bars = client.get_stock_bars(req)
    return bars.model_dump()

def process_stock_data(
    ticker: str,
    start_date: list[int] | tuple[int, int, int],
    end_date: list[int] | tuple[int, int, int],
    interval: TimeFrame = TimeFrame.Hour,
):
    start = datetime(start_date[0], start_date[1], start_date[2], tzinfo=timezone.utc)
    end   = datetime(end_date[0], end_date[1], end_date[2], tzinfo=timezone.utc)

    data = get_raw_stock_data([ticker], start_date=start, end_date=end, interval=interval)
    if not data or "data" not in data or ticker not in data["data"]:
        print(f"No data returned for {ticker}")
        return []

    cleaned = []
    for record in data["data"][ticker]:
        # timestamp key is often "t" in alpaca dumps
        ts = record.get("timestamp") or record.get("t")
        if isinstance(ts, datetime):
            ts_str = ts.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        else:
            ts_str = str(ts)

        record["timestamp"] = ts_str
        record["symbol"] = ticker

        # drop noisy keys (alpaca uses n/vw sometimes)
        record.pop("trade_count", None)
        record.pop("vwap", None)
        record.pop("n", None)
        record.pop("vw", None)

        cleaned.append(record)

    return cleaned

if __name__ == "__main__":
    for ticker in TICKERS:

        start_dt = [2026, 1, 1]    
        end_dt   = [2026, 1, 5]     
        inter = TimeFrame.Hour

        print("=" * 100)
        print(f"\nProcessing {ticker} Data\n")
        print 
        rows = process_stock_data(
            ticker,
            start_date=start_dt,
            end_date=end_dt,
            interval=inter,
        )

        for r in rows:
            print(r)
        
        print("=" * 100)
        print("\n")
        sleep(1)