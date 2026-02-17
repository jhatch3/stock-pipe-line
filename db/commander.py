import asyncpg
import asyncio
from contextlib import asynccontextmanager
import re
from typing import List, Dict, Any, Optional

from db.DBConnection import DBConnection

# SQL identifier validation pattern
_IDENT = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

def _check_ident(name: str) -> str:
    """Validate SQL identifier to prevent SQL injection"""
    if not name or not _IDENT.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return name


class AsyncCommander:
    """
    Async database commander using asyncpg connection pooling.
    Handles concurrent access efficiently without threads.
    """
    
    def __init__(self):
        """Initialize AsyncCommander (call connect() after creation)"""
        self.pool: Optional[asyncpg.Pool] = None
    
    async def connect(self, min_size=2, max_size=10) :
        """
        Create connection pool.
        
        Args:
            min_size: Minimum number of connections
            max_size: Maximum number of connections
            **db_params: Database parameters (host, database, user, password, port)
            
        Usage:
            commander = AsyncCommander()
            await commander.connect()
        """
        try:
            self.pool = await asyncpg.create_pool(
                min_size=min_size,
                max_size=max_size,
                host='localhost', 
                database='stock_db', 
                user='db_user', 
                password='db_password',
                port=5000
            )
            print(f"AsyncCommander initialized with connection pool ({min_size}-{max_size} connections)")
        except Exception as e:
            raise ConnectionError(f"Failed to create connection pool: {e}")
    
    @asynccontextmanager
    async def acquire(self):
        """
        Context manager to acquire a connection from the pool.
        
        Usage:
            async with commander.acquire() as conn:
                result = await conn.fetch(query)
        """
        async with self.pool.acquire() as connection:
            yield connection
    
    async def execute_query(self, query: str, *args, fetch_one=False, fetch_all=True):
        """
        Execute a query with automatic connection handling.
        
        Args:
            query: SQL query string
            *args: Query parameters (uses $1, $2, etc. in query)
            fetch_one: Fetch single row
            fetch_all: Fetch all rows
            
        Returns:
            Query results or status
        """
        try:
            async with self.acquire() as conn:
                if fetch_one:
                    return await conn.fetchrow(query, *args)
                elif fetch_all:
                    return await conn.fetch(query, *args)
                else:
                    return await conn.execute(query, *args)
        except Exception as e:
            print(f"Query execution error: {e}")
            return None
    
    async def list_tables(self, show: bool = True) -> List[str]:
        """
        List all tables in the database.
        
        Args:
            show: If True, prints tables; if False, only returns list
            
        Returns:
            List of table names
        """
        query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_type = 'BASE TABLE' 
            AND table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_name;
        """
        
        tables = await self.execute_query(query)
        
        if tables:
            table_names = [table['table_name'] for table in tables]
            if show:
                print("Tables in the database:")
                for name in table_names:
                    print(f"- {name}")
            return table_names
        else:
            if show:
                print("No tables in database")
            return []
    
    async def create_table(self, table_name: str, cols: Dict[str, str], if_not_exists: bool = True):
        """
        Create a table.
        
        Args:
            table_name: Name of the table to create
            cols: Dictionary of column_name: column_type
            if_not_exists: Use IF NOT EXISTS clause
        """
        _check_ident(table_name)
        
        if not cols:
            print("Cannot create empty table")
            return
        
        try:
            # Build column definitions
            col_definitions = []
            for col_name, col_type in cols.items():
                if col_type.strip():
                    # Validate column name
                    if not any(keyword in col_name.upper() for keyword in 
                              ['UNIQUE', 'PRIMARY KEY', 'FOREIGN KEY', 'CHECK']):
                        _check_ident(col_name)
                    col_definitions.append(f'"{col_name}" {col_type}')
                else:
                    # This is a table constraint
                    col_definitions.append(col_name)
            
            columns_sql = ", ".join(col_definitions)
            
            # Build CREATE TABLE query
            if_clause = "IF NOT EXISTS " if if_not_exists else ""
            query = f'CREATE TABLE {if_clause}"{table_name}" ({columns_sql});'
            
            await self.execute_query(query, fetch_all=False)
            print(f"Table '{table_name}' successfully created")
            
        except Exception as e:
            print(f"Error creating table '{table_name}': {e}")
    
    async def enter_record(self, table_name: str, values: Dict[str, Any]) -> str:
        """
        Insert a record into a table.
        
        Args:
            table_name: Name of the table
            values: Dictionary of column_name: value
            
        Returns:
            Query status
        """
        _check_ident(table_name)
        
        if not values:
            raise ValueError(f"No values to insert into {table_name}")
        
        # Validate column names
        for col in values.keys():
            _check_ident(col)
        
        cols = list(values.keys())
        params = [values[c] for c in cols]
        
        # Build query with $1, $2, etc. placeholders
        col_str = ", ".join(f'"{c}"' for c in cols)
        placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
        
        query = f'INSERT INTO "{table_name}" ({col_str}) VALUES ({placeholders})'
        
        return await self.execute_query(query, *params, fetch_all=False)
    
    
    async def delete_table(self, table_name: str):
        """
        Delete a table.
        
        Args:
            table_name: Name of the table to delete
        """
        _check_ident(table_name)
        
        try:
            query = f'DROP TABLE IF EXISTS "{table_name}" CASCADE'
            await self.execute_query(query, fetch_all=False)
            print(f"Table '{table_name}' successfully deleted!")
        except Exception as e:
            print(f"Error deleting table '{table_name}': {e}")
    
    async def delete_all_tables(self):
        """Delete all tables in the database - use with caution!"""
        tables = await self.list_tables(show=False)
        if tables:
            for table in tables:
                await self.delete_table(table)
        else:
            print("No tables to delete")
    
    async def table_exists(self, table_name: str) -> bool:
        """
        Check if a table exists.
        
        Args:
            table_name: Name of the table to check
            
        Returns:
            True if table exists, False otherwise
        """
        _check_ident(table_name)
        
        query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            );
        """
        
        result = await self.execute_query(query, table_name, fetch_one=True)
        return result['exists'] if result else False
    
    async def close(self):
        """Close all connections in the pool"""
        if self.pool:
            await self.pool.close()
            print("All connections closed")
    
    async def __aenter__(self):
        """Support async context manager"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Support async context manager"""
        await self.close()


async def main():
    """Example usage"""
    print("===============================================")
    
    # Initialize and connect
    commander = AsyncCommander()
    await commander.connect()
    
    print("===============================================")
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
    
    indicators_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'indicator_type': 'VARCHAR(25)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    await commander.create_table("stock_indicators", indicators_cols)
    
    ai_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'ai_summary': 'VARCHAR(4500)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    await commander.create_table("stock_ai_summary", ai_cols)
    
    report_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'report_type': 'VARCHAR(25)',
        'report_content': 'VARCHAR(4500)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    await commander.create_table("stock_reports", report_cols)
    
    print("===============================================")
    await commander.list_tables()
    print("===============================================")
    
    # Example: enter
    print("\nExample: Using Enter to prevent race conditions")
    await commander.enter_record(
        "stock_indicators",
        {
            "symbol": "AAPL",
            "indicator_type": "RSI"
        }
    )
    
    data = await commander.execute_query("SELECT * FROM stock_indicators")

    print(data)
    print("===============================================")
    #Uncomment to delete all tables
    await commander.delete_all_tables()
    print("===============================================")
    
    await commander.close()


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())