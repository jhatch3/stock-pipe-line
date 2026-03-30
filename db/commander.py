"""
Supabase-backed commander
------------------------

This replaces the previous psycopg2/Postgres implementation with the Supabase
Python client. Only the features used by the pipelines are implemented:

- insert / upsert dictionaries
- simple row counts

Schema management (CREATE TABLE / indexes) is not performed here; create your
tables in Supabase first.
"""

from __future__ import annotations

import logging
import os
import json 
from typing import List, Dict, Any, Iterable, Optional

from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
import pprint
import datetime as dt 
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] commander - %(message)s",
)
logger = logging.getLogger("commander")

load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")
KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
)

assert SUPABASE_URL, "SUPABASE_URL must be set in .env file"
assert KEY, "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY must be set in .env file"


class Commander:
    """
    Lightweight Supabase data helper.
    """

    def __init__(self):
        url = SUPABASE_URL
        key = KEY

        self.client: Client = create_client(url, key)
        logger.info("Supabase client initialized for %s", url)

    def _store_response(self, response: dict):
        """Store the agent response in the stock_ai_data table."""
        raise NotImplementedError("store_response is not implemented in this version.")

    def _upsert(
        self,
        table_name: str,
        records: List[Dict[str, Any]],
        conflict_columns: Optional[List[str]] = None,
        upsert: bool = True,
    ):
        if not records:
            return 0

        # Supabase upsert accepts on_conflict string (comma-separated)
        on_conflict = ",".join(conflict_columns) if conflict_columns else None
        if upsert:
            resp = self.client.table(table_name).upsert(
                records, on_conflict=on_conflict
            ).execute()
        else:
            resp = self.client.table(table_name).insert(records).execute()

        count = len(resp.data or [])
        logger.debug("Supabase upsert/insert into %s -> %d rows", table_name, count)
        return count

    def bulk_insert_dicts(
        self,
        table_name: str,
        records: List[Dict[str, Any]],
        conflict_columns: Optional[List[str]] = None,
        upsert: bool = True,
    ) -> int:
        """
        Insert or upsert a list of dictionaries. No chunking is done; Supabase
        will handle pagination internally up to its limits.
        """
        return self._upsert(table_name, records, conflict_columns, upsert)

    def enter_record(self, table_name: str, values: Dict[str, Any]) -> int:
        """Insert a single record (upsert for convenience)."""
        return self.bulk_insert_dicts(table_name, [values], upsert=True)

    def count_rows(self, table_name: str) -> int:
        """Return exact row count using PostgREST count metadata."""
        try:
            resp = (
                self.client.table(table_name)
                .select("*", count="exact")
                .limit(1)  
                .execute()
            )
            return int(resp.count or 0)
        except APIError as e:
            msg = str(e)
            logger.warning(msg)
            raise

    def list_tables(self, show: bool = True):
        msg = "list_tables is not supported via Supabase; manage schema in Supabase UI."
        if show:
            print(msg)
        logger.warning(msg)
        return []

    def fetch_ohlcv(self, ticker: str, interval: str, limit: int = 2000) -> "pd.DataFrame":
        """
        Fetch the most recent `limit` OHLCV rows for a ticker/interval from
        clean_stock_data_yf, returned as a DataFrame indexed by UTC timestamp
        in ascending order.
        """
        resp = (
            self.client.table("stock_clean_data_yf")
            .select("timestamp,open,high,low,close,volume")
            .eq("ticker", ticker)
            .eq("interval", interval)
            .order("timestamp", desc=True)
            .limit(limit)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return pd.DataFrame()

        df = pd.DataFrame(rows)
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        df = df.set_index("timestamp").sort_index()
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col])
        return df

    def delete_table(self, table_name: str):
        """Soft fallback: delete all rows from table."""
        logger.info("Deleting all rows from %s via Supabase", table_name)
        self.client.table(table_name).delete().neq("id", None).execute()

    def store_clean_ticker_news(self, ticker: str, news_list: List[Dict[str, Any]]):
        """Store news articles for a given ticker."""
        
        # Basic Check: Ensure ticker is provided and news_list is not empty
        if not ticker:
            logger.warning("Ticker symbol must be provided to store news.")
            return 0
        
        if not news_list:
            logger.warning("No news to store for ticker %s", ticker)
            return 0

        records = []
        for article in news_list:
            record = {
                "ticker": ticker,
                "id": article.get("id"),
                "author": article.get("author"),
                "url": article.get("url"),
                "source": article.get("source"),
                "created_at": article.get("created_at"),
                "headline": article.get("headline"),
                "summary": article.get("summary"),
            }
            
            records.append(record)

        count = self.bulk_insert_dicts(
            table_name="clean_stock_news_data",
            records=records,
            conflict_columns=["id"],
            upsert=True,
        )
        logger.info("Stored %d news articles for ticker %s", count, ticker)
        return count
    
    def store_raw_ticker_news(self, ticker: str, raw_news: List[Dict[str, Any]]):
        """Store raw news articles for a given ticker."""
        
        # Basic Check: Ensure ticker is provided and raw_news is not empty
        if not ticker:
            logger.warning("Ticker symbol must be provided to store raw news.")
            return 0
        
        if not raw_news:
            logger.warning("No raw news to store for ticker %s", ticker)
            return 0

        records = []
        for article in raw_news:
            record = {
                "ticker": ticker,
                "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "id": article.get("id"),
                "data": json.dumps(article),
            }
            
            records.append(record)

        count = self.bulk_insert_dicts(
            table_name="raw_stock_news_data",
            records=records,
            conflict_columns=["id"],
            upsert=True,
        )
        logger.info("Stored %d raw news articles for ticker %s", count, ticker)
        return count
    
    def get_tickers(self) -> list[str]:
        """Fetch all ticker symbols from the tickers table."""
        resp = (
            self.client.table("tickers")
            .select("symbol")
            .execute()
        )
        return [row["symbol"] for row in (resp.data or [])]

    def get_ticker_news(self, ticker: str) -> str:
        """Return JSON string of news for a given ticker."""
        try:
            resp = (
                self.client.table("clean_stock_news_data")
                .select("*")
                .eq("ticker", ticker)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            news_list = resp.data or []
            return json.dumps({"news": news_list})
        except APIError as e:
            logger.warning("Failed to retrieve news for ticker %s: %s", ticker, e)
            return json.dumps({"news": []})
        
if __name__ == "__main__":
    c = Commander()
    
