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
from typing import List, Dict, Any, Iterable, Optional

from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
from postgrest.exceptions import APIError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] commander - %(message)s",
)
logger = logging.getLogger("commander")

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise EnvironmentError(
            f"{name} must be set (Supabase credentials required). "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY/ANON_KEY)."
        )
    return value


class Commander:
    """
    Lightweight Supabase data helper.
    """

    def __init__(self):
        url = _require_env("SUPABASE_URL")
        key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
        )
        if not key:
            raise EnvironmentError(
                "Supabase key missing. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY."
            )

        self.client: Client = create_client(url, key)
        logger.info("Supabase client initialized for %s", url)

    # ------------------------------------------------------------------ helpers

    def _store_response(self, response: dict):
        """Store the agent response in the stock_ai_data table."""
        record = {
            "name": response.get("commander_name"),
            "ticker": response.get("ticker"),
            "summary": response.get("summary", ""),
            "sources": response.get("sources", []),
            "created_at": response.get("as_of_utc"),
        }
        count = self._upsert(
            table_name="stock_ai_data",
            records=[record],
            conflict_columns=["ticker", "name", "created_at"],
            upsert=True,
        )
        logger.info("Stored response for %s -> %d rows", record["ticker"], count)

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

    # ------------------------------------------------------------------ public
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

    # Legacy-compatible no-op stubs (schema handled outside this module)
    def list_tables(self, show: bool = True):
        msg = "list_tables is not supported via Supabase; manage schema in Supabase UI."
        if show:
            print(msg)
        logger.warning(msg)
        return []

    def delete_table(self, table_name: str):
        """Soft fallback: delete all rows from table."""
        logger.info("Deleting all rows from %s via Supabase", table_name)
        self.client.table(table_name).delete().neq("id", None).execute()

if __name__ == "__main__":
    c = Commander()
    print("Connected to Supabase. Example count:", c.count_rows("stock_raw_data_yf"))
