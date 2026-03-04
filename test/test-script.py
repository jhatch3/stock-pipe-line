from db.commander import Commander
from agent.agent import Agent
from data.ticker_list import TICKERS
from data.stock_yf import populate_all_tickers
from db.runtime import get_commander
from pprint import pprint
from time import sleep
from alpaca.data.timeframe import TimeFrame

import dotenv, os
import asyncio
import logging

from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("Test Script")


dotenv.load_dotenv()

# Use uppercase env names, fallback to defaults if missing
RAW_TABLE = os.getenv("RAW_TABLE")
CLEAN_TABLE = os.getenv("CLEAN_TABLE")

assert RAW_TABLE is not None, "Environment variable RAW_TABLE is not set"
assert CLEAN_TABLE is not None, "Environment variable CLEAN_TABLE is not set"

async def main():
    """Example usage"""
    
    # Initialize and connect
    commander = get_commander()
    
    
    print("===============================================")
    commander.list_tables()
    print("===============================================")
    
    print(f"Gathering Stock Data !!")
    
    time_before = datetime.now(timezone.utc)
    logger.info("Starting Yahoo Finance ingestion at %s", time_before.isoformat())
    #commander.delete_all_tables()
   

    # ==== Uncomment one of the following lines to either populate all tickers or refill the last 3 days of data for all tickers ====
    # Populate all tickers with full historical data (this may take a long time) -> When app is first loaded
    # refill_all_tickers(look_back_amount=3) -> Refill last 3 days of data for all tickers (this is faster) -> When app is already loaded

    populate_all_tickers()
    #refill_all_tickers(look_back_amount=30)    
    
    time_after = datetime.now(timezone.utc)
    logger.info("Finished Yahoo Finance ingestion at %s", time_after.isoformat())
    logger.info("Total time taken: %s minutes", (time_after - time_before).total_seconds() / 60.0)

    logger.info("Total rows in %s: %d", RAW_TABLE, commander.count_rows(RAW_TABLE))
    logger.info("Total rows in %s: %d", CLEAN_TABLE, commander.count_rows(CLEAN_TABLE))


    data = []
    print("=" * 100)
    

    populate_all_tickers()


    print("=" * 100)
    print("\n")
    sleep(1)
    
    print("\n===============================================")
    #Uncomment to delete all tables
    #commander.delete_all_tables()
    print("===============================================")
    

if __name__ == "__main__":
    # Run the async main function
    
    # Uncomment to pipe output into ./out.txt
    # python -m test_script > out.txt 

    asyncio.run(main())
