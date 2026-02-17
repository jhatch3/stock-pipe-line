from test.ticker_list_check import validate_tickers
from ticker_list import TICKERS 





if __name__ == "__main__":
    print(f"{'=' * 25} Running Master Test {'=' * 25}")

    print("\nValidating TICKERS in ticker_list.py")
    valid, invalid = validate_tickers(TICKERS)

    if len(valid) == len(TICKERS):
        print("Passed TICKER CHECK !!")

    else:
        print("Failed TICKER CHECK !!")
        print("Invalid Ticker List: " + f"{invalid}")

    print("\n")
    print(f"{'=' * 71}")