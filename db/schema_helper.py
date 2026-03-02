"""
Schema helper
-------------

Supabase (Postgres).

!!!!!!!!!!!!!

Run the returned SQL in the Supabase SQL editor or psql against your project.
This module does not execute any SQL itself.

!!!!!!!!!!!!!

"""

from __future__ import annotations

from typing import Tuple


def yahoo_finance_tables(
    raw_table: str = "stock_raw_data_yf",
    clean_table: str = "stock_clean_data_yf",
) -> str:
    """Return SQL to create the Yahoo Finance raw/clean tables and index."""
    return f"""
-- Raw table (Yahoo Finance)
CREATE TABLE IF NOT EXISTS {raw_table} (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    payload JSONB NOT NULL,
    interval VARCHAR(10) NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Clean table (Yahoo Finance)
CREATE TABLE IF NOT EXISTS {clean_table} (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    interval VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(12,4) NOT NULL,
    high DECIMAL(12,4) NOT NULL,
    low DECIMAL(12,4) NOT NULL,
    close DECIMAL(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL
);

-- Uniqueness for curated layer
CREATE UNIQUE INDEX IF NOT EXISTS {clean_table}_sym_int_ts_idx
ON {clean_table} (symbol, interval, "timestamp");
""".strip()


def yf_tables_sql() -> str:
    """
    Convenience helper for the exact legacy Yahoo tables:
    stock_raw_data_yf and stock_clean_data_yf.
    """
    return yahoo_finance_tables(
        raw_table="stock_raw_data_yf",
        clean_table="stock_clean_data_yf",
    )


def alpaca_tables(
    raw_table: str = "stock_raw_data_alpaca",
    clean_table: str = "stock_clean_data_alpaca",
) -> str:
    """Return SQL to create the Alpaca raw/clean tables and index."""
    return f"""
-- Raw table (Alpaca)
CREATE TABLE IF NOT EXISTS {raw_table} (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    interval VARCHAR(10) NOT NULL,
    payload JSONB NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Clean table (Alpaca)
CREATE TABLE IF NOT EXISTS {clean_table} (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    interval VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(12,4) NOT NULL,
    high DECIMAL(12,4) NOT NULL,
    low DECIMAL(12,4) NOT NULL,
    close DECIMAL(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS {clean_table}_sym_int_ts_idx
ON {clean_table} (symbol, interval, "timestamp");
""".strip()


def all_tables_sql() -> str:
    """Return combined SQL for both Yahoo Finance and Alpaca tables."""
    return yahoo_finance_tables() + "\n\n" #+ alpaca_tables()


if __name__ == "__main__":
    # Print combined SQL so users can copy/paste into Supabase SQL editor.
    print(all_tables_sql())
