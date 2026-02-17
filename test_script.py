from db.DBConnection import DBConnection
from db.commander import Commander
from agent.agent import Agent
from data.stock import process_stock_data
from ticker_list import TICKERS

from pprint import pprint
from time import sleep 
from alpaca.data.timeframe import TimeFrame

import asyncio
from datetime import datetime, timezone


async def main():
    """Example usage"""
    print("===============================================")
    
    # Initialize and connect
    commander = Commander()
    
    print("===============================================")
    commander.delete_all_tables()
    commander.list_tables()
    print("===============================================")
    
    # Define table schemas
    stock_cols = {
        "id": "SERIAL PRIMARY KEY",
        "symbol": "VARCHAR(10) NOT NULL",
        "timestamp": "TIMESTAMPTZ NOT NULL",
        "open": "DECIMAL(12,4) NOT NULL",
        "high": "DECIMAL(12,4) NOT NULL",
        "low": "DECIMAL(12,4) NOT NULL",
        "close": "DECIMAL(12,4) NOT NULL",
        "volume": "BIGINT NOT NULL",
        "last_updated": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "UNIQUE (symbol, timestamp)": ""
    }
    commander.create_table("stock_data", stock_cols)
    
    
    ai_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'ai_summary': 'VARCHAR(4500)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    commander.create_table("stock_ai_summary", ai_cols)
    

    
    print("===============================================")
    commander.list_tables()
    print("===============================================")
    
    print(f"Gathering Stock Data !!")
    
    data = []
    print("=" * 100)
    
    for ticker in TICKERS:
        print(f"\nProcessing {ticker} Data")
        start_dt = [2026, 1, 1]    
        end_dt   = [2026, 1, 5]     
        inter = TimeFrame.Hour

        rows = process_stock_data(
            ticker,
            start_date=start_dt,
            end_date=end_dt,
            interval=inter,
        )

        data.extend(rows)

    print("=" * 100)
    print("\n")
    sleep(1)
    
    commander.bulk_insert_dicts("stock_data", data,  conflict_columns=["symbol", "timestamp"])

    data = commander.execute_query("""
        SELECT symbol, AVG(open) AS avg_open FROM stock_data GROUP BY symbol ORDER BY symbol;
        """)
    
    print(f"\nGetting records in stock_data Table By Symbol\n")
    for record in data:
        print(f"    - Symbol {record[0]} | Average Open ${round(record[1], 2)} ")
    

    print("\n===============================================")
    #Uncomment to delete all tables
    commander.delete_all_tables()
    print("===============================================")
    

if __name__ == "__main__":
    # Run the async main function
    
    # Uncomment to pipe output into ./out.txt
    # python -m test_script > out.txt 

    asyncio.run(main())