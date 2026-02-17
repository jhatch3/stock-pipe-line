from db.DBConnection import DBConnection
from db.commander import AsyncCommander
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
    commander = AsyncCommander()
    await commander.connect()
    
    print("===============================================")
    await commander.delete_all_tables()
    await commander.list_tables()
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
    await commander.create_table("stock_data", stock_cols)
    
    
    ai_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'ai_summary': 'VARCHAR(4500)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    await commander.create_table("stock_ai_summary", ai_cols)
    

    
    print("===============================================")
    await commander.list_tables()
    print("===============================================")
    
    print(f"Gathering Stock Data !!")
    
    start_dt = [2025, 1, 1]    
    end_dt   = [2026, 1, 1]     
    inter = TimeFrame.Day
    
    for symbol in TICKERS[::10]:

        print(f"\nProcessing {symbol} Data")
        data = process_stock_data(ticker=symbol, start_date=start_dt, end_date=end_dt)

        print("Entering records Into stock_data")
        for rows in data:
            rows["timestamp"] = datetime.fromisoformat(
                                rows["timestamp"].replace(" UTC", "+00:00")
                            ).astimezone(timezone.utc)
            await commander.enter_record(table_name='stock_data', values=rows)
    
    data = await commander.execute_query("""
        SELECT
            symbol,
            avg(close) as avg_close,
            avg(open) AS avg_open,
            avg(volume) AS avg_volume
                                         
        FROM stock_data
        GROUP BY symbol
        ORDER BY symbol;
    """)
    
    print(f"\nGetting records in stock_data Table By Symbol\n")
    for record in data:
        print(f"    - Symbol {record['symbol']} | Average Open ${record['avg_open']} | Average Close ${record['avg_close']} | Average Volume {record['avg_volume']}")
    
    print("\n===============================================")
    #Uncomment to delete all tables
    await commander.delete_all_tables()
    print("===============================================")
    
    await commander.close()


if __name__ == "__main__":
    # Run the async main function
    
    # Uncomment to pipe output into ./out.txt
    # python -m test_script > out.txt 

    asyncio.run(main())