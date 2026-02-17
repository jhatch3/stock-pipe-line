from dotenv import load_dotenv
import os

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass, AssetStatus

from ticker_list import TICKERS 

load_dotenv()
ALPACA_KEY = os.getenv("ALPACA_KEY")
ALPACA_SECRET = os.getenv("ALPACA_SECRET")

assert ALPACA_KEY, "ALPACA_KEY must be set in .env file"
assert ALPACA_SECRET, "ALPACA_SECRET must be set in .env file"


trading = TradingClient(ALPACA_KEY, ALPACA_SECRET, paper=True)

def validate_tickers(tickers: list[str]):
    # Pull the full active US equity list from Alpaca
    req = GetAssetsRequest(
        asset_class=AssetClass.US_EQUITY,
        status=AssetStatus.ACTIVE,
    )
    assets = trading.get_all_assets(req)

    alpaca_symbols = {a.symbol for a in assets}  # what Alpaca recognizes

    valid = [t for t in tickers if t in alpaca_symbols]
    invalid = [t for t in tickers if t not in alpaca_symbols]
    return valid, invalid

if __name__ == "__main__":
    print(f"{'=' * 25} Running Ticker Validator Test Files {'=' * 25}")

    print("Validating TICKERS in ticker_list.py")
    valid, invalid = validate_tickers(TICKERS)

    if len(valid) == len(TICKERS):
        print("Passed TICKER CHECK !!")

    else:
        print("Failed TICKER CHECK !!")
        print("Invalid Ticker List: " + f"{invalid}")

    print(f"{'=' * 64}")