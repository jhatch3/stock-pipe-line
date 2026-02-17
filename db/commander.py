import psycopg2
from psycopg2 import sql, pool
from psycopg2.extensions import ISOLATION_LEVEL_READ_COMMITTED
from contextlib import contextmanager
import re
from typing import List, Dict, Any, Optional

# SQL identifier validation pattern
_IDENT = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

def _check_ident(name: str) -> str:
    """Validate SQL identifier to prevent SQL injectiod
    
    USAGE:
    
    VALID (these pass):
    _check_ident("users")           # OK
    _check_ident("stock_data")      # OK
    _check_ident("Table123")        # OK
    _check_ident("_internal")       # OK

    INVALID (these raise errors):
    _check_ident("users; DROP")     # Has semicolon
    _check_ident("users--comment")  # Has dashes
    _check_ident("user name")       # Has space
    _check_ident("users'OR'1=1")   # Has quotes
    _check_ident("123table")        # Starts with number
    _check_ident("")                # Empty string
    
    """
    
    
    if not name or not _IDENT.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return name


class Commander:
    """
    Database commander using connection pooling.
    Handles concurrent access without threads.
    """
    
    def __init__(self, min_conn=2, max_conn=10):
        """
        Initialize Commander with connection pooling.
        
        Args:
            min_conn: Minimum number of connections in pool
            max_conn: Maximum number of connections in pool
        """
        try:
            # Create connection pool
            self.pool = pool.SimpleConnectionPool(
                min_conn,
                max_conn,
                host='localhost',
                database='stock_db',
                user='db_user',
                password='db_password',
                port=5000
            )
            
            if self.pool:
                print(f"Commander initialized with connection pool ({min_conn}-{max_conn} connections)")
            else:
                raise ConnectionError("Failed to create connection pool")
                
        except psycopg2.Error as e:
            raise ConnectionError(f"Failed to establish database connection pool: {e}")
    
    @contextmanager
    def get_connection(self):
        """
        Context manager to get a connection from the pool.
        Automatically returns connection to pool when done.
        
        Usage:
            with commander.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
        """
        conn = self.pool.getconn()
        try:
            yield conn
        finally:
            self.pool.putconn(conn)
    
    @contextmanager
    def get_cursor(self, commit=True, isolation_level=ISOLATION_LEVEL_READ_COMMITTED):
        """
        Context manager to get a cursor with automatic transaction handling.
        
        Args:
            commit: Whether to commit after successful execution
            isolation_level: Transaction isolation level
            
        Usage:
            with commander.get_cursor() as cur:
                cur.execute(query)
        """
        with self.get_connection() as conn:
            old_isolation = conn.isolation_level
            conn.set_isolation_level(isolation_level)
            
            cursor = conn.cursor()
            try:
                yield cursor
                if commit:
                    conn.commit()
            except Exception as e:
                conn.rollback()
                raise
            finally:
                cursor.close()
                conn.set_isolation_level(old_isolation)
    
    def execute_query(self, query, params=None, fetch=True, isolation_level=ISOLATION_LEVEL_READ_COMMITTED):
        """
        Execute a query with automatic connection handling.
        
        Args:
            query: SQL query string or psycopg2.sql.Composed object
            params: Query parameters
            fetch: Whether to fetch results (True) or return rowcount (False)
            isolation_level: Transaction isolation level
            
        Returns:
            Query results (if fetch=True) or row count (if fetch=False)
        """
        try:
            with self.get_cursor(commit=True, isolation_level=isolation_level) as cursor:
                cursor.execute(query, params)
                
                # If the query returned rows, cursor.description will be set
                if cursor.description is not None and fetch:
                    return cursor.fetchall()
                else:
                    return cursor.rowcount
                    
        except psycopg2.Error as e:
            print(f"Query execution error: {e}")
            return None
    
    def list_tables(self, show: bool = True):
        """
        List all tables in the database.
        
        Args:
            show: If True, prints tables; if False, only returns list
            
        Returns:
            List of table names
        """
        tables = self.execute_query("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_type = 'BASE TABLE' 
            AND table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_name;
        """)
        
        if tables:
            if show:
                print("Tables in the database:")
                for table in tables:
                    print(f"- {table[0]}")
            return [table[0] for table in tables]
        else:
            if show:
                print("No tables in database")
            return []
    
    def create_table(self, table_name: str, cols: dict = None, if_not_exists: bool = True):
        """
        Create a table safely with proper isolation.
        
        Args:
            table_name: Name of the table to create
            cols: Dictionary of column_name: column_type
            if_not_exists: Use IF NOT EXISTS clause (recommended)
        """
        _check_ident(table_name)
        
        if not cols:
            print("Cannot create empty table")
            return
        
        try:
            # Build column definitions
            col_definitions = []
            for col_name, col_type in cols.items():
                if col_type.strip():  # Skip empty column types (like UNIQUE constraints)
                    # Validate column name only if it's a normal column
                    if not any(keyword in col_name.upper() for keyword in ['UNIQUE', 'PRIMARY KEY', 'FOREIGN KEY', 'CHECK']):
                        _check_ident(col_name)
                    col_definitions.append(f"{col_name} {col_type}")
                else:
                    # This is a table constraint
                    col_definitions.append(col_name)
            
            columns_sql = ", ".join(col_definitions)
            
            # Build CREATE TABLE query
            if if_not_exists:
                query = sql.SQL("CREATE TABLE IF NOT EXISTS {table} ({columns})").format(
                    table=sql.Identifier(table_name),
                    columns=sql.SQL(columns_sql)
                )
            else:
                query = sql.SQL("CREATE TABLE {table} ({columns})").format(
                    table=sql.Identifier(table_name),
                    columns=sql.SQL(columns_sql)
                )
            
            self.execute_query(query, fetch=False)
            print(f"Table '{table_name}' successfully created")
            
        except psycopg2.Error as e:
            print(f"Error creating table '{table_name}': {e}")
    
    def enter_record(self, table_name: str, values: dict):
        """
        Insert a record into a table (RACE-CONDITION FREE with UPSERT).
        
        Args:
            table_name: Name of the table
            values: Dictionary of column_name: value
            
        Returns:
            Number of rows affected
        """
        _check_ident(table_name)
        
        if not values:
            raise ValueError(f"No values to insert into {table_name}")
        
        # Validate column names
        for col in values.keys():
            _check_ident(col)
        
        cols = list(values.keys())
        params = [values[c] for c in cols]
        
        # Build UPSERT query (INSERT ... ON CONFLICT DO UPDATE)
        query = sql.SQL(
            "INSERT INTO {table} ({cols}) VALUES ({ph}) "
            "ON CONFLICT DO UPDATE SET {updates}"
        ).format(
            table=sql.Identifier(table_name),
            cols=sql.SQL(", ").join(sql.Identifier(c) for c in cols),
            ph=sql.SQL(", ").join(sql.Placeholder() for _ in cols),
            updates=sql.SQL(", ").join(
                sql.SQL("{col} = EXCLUDED.{col}").format(col=sql.Identifier(c))
                for c in cols
            )
        )
        
        return self.execute_query(query, params, fetch=False)

    def bulk_insert(self, table_name: str, columns: List[str], values_list: List[tuple], upsert: bool = True):
        """
        Efficiently insert multiple records at once (RACE-CONDITION FREE).
        
            
        Example:
            commander.bulk_insert(
                "stock_data",
                ["symbol", "timestamp", "open", "high", "low", "close", "volume"],
                [
                    ("AAPL", "2024-01-01 10:00:00", 150.00, 151.00, 149.00, 150.50, 1000000),
                    ("GOOGL", "2024-01-01 10:00:00", 140.00, 141.00, 139.00, 140.50, 2000000),
                ]
            )
        """
        _check_ident(table_name)
        
        for col in columns:
            _check_ident(col)
        
        if not values_list:
            return 0
        
        try:
            with self.get_cursor(commit=True) as cursor:
                # Build base query
                query = sql.SQL("INSERT INTO {table} ({cols}) VALUES ({ph})").format(
                    table=sql.Identifier(table_name),
                    cols=sql.SQL(", ").join(sql.Identifier(c) for c in columns),
                    ph=sql.SQL(", ").join(sql.Placeholder() for _ in columns),
                )
                
                # Add conflict handling
                if upsert:
                    # Update all columns on conflict
                    updates = sql.SQL(", ").join(
                        sql.SQL("{col} = EXCLUDED.{col}").format(col=sql.Identifier(c))
                        for c in columns
                    )
                    query = sql.SQL("{query} ON CONFLICT DO UPDATE SET {updates}").format(
                        query=query,
                        updates=updates
                    )
                else:
                    # Ignore conflicts
                    query = sql.SQL("{query} ON CONFLICT DO NOTHING").format(query=query)
                
                # Use executemany for bulk insert (much faster than individual inserts)
                cursor.executemany(query, values_list)
                return cursor.rowcount
                
        except psycopg2.Error as e:
            print(f"Bulk insert error: {e}")
            return 0
        
    def bulk_insert_dicts(self, table_name: str, records: List[dict], upsert: bool = True):
        """
        Bulk insert from a list of dictionaries (more convenient).
            
        Example:
            commander.bulk_insert_dicts("stock_data", [
                {

                },
                {

                }
            ])
        """
        if not records or not table_name:
            print("Error Inserting Bulk dicts data")
            return 0
        
        # Extract columns from first record
        columns = list(records[0].keys())
        
        # Convert dictionaries to tuples in the same column order
        values = [tuple(record[col] for col in columns) for record in records]
        
        return self.bulk_insert(table_name, columns, values, upsert=upsert)

    def delete_table(self, table_name: str):
        """
        Delete a table.
        
        Args:
            table_name: Name of the table to delete
        """
        _check_ident(table_name)
        
        try:
            query = sql.SQL("DROP TABLE IF EXISTS {table} CASCADE").format(
                table=sql.Identifier(table_name)
            )
            self.execute_query(query, fetch=False)
            print(f"Table '{table_name}' successfully deleted!")
            
        except Exception as e:
            print(f"Error deleting table '{table_name}': {e}")
    
    def delete_all_tables(self):
        """
        Delete all tables in the database - use with caution!
        """
        tables = self.list_tables(show=False)
        if tables:
            for table in tables:
                self.delete_table(table)
        else:
            print("No tables to delete")
    
    def table_exists(self, table_name: str) -> bool:
        """
        Check if a table exists.
        
        Args:
            table_name: Name of the table to check
            
        Returns:
            True if table exists, False otherwise
        """
        _check_ident(table_name)
        
        query = sql.SQL("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            );
        """)
        
        result = self.execute_query(query, (table_name,))
        return result and result[0][0] if result else False
    
    def close_all_connections(self):
        """Close all connections in the pool"""
        if self.pool:
            self.pool.closeall()
            print("All connections closed")
    
    def __del__(self):
        """Clean up resources"""
        try:
            self.close_all_connections()
        except:
            print("Error Cleaning Up __del__")
            pass
        print("Commander cleanup complete")
        print("===============================================")


if __name__ == "__main__":
    print("===============================================")
    
    commander = Commander(min_conn=2, max_conn=10)
    
    print("===============================================")
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
    
    indicators_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'indicator_type': 'VARCHAR(25)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    commander.create_table("stock_indicators", indicators_cols)
    
    ai_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'ai_summary': 'VARCHAR(4500)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    commander.create_table("stock_ai_summary", ai_cols)
    
    report_cols = {
        'id': 'SERIAL PRIMARY KEY',
        'symbol': 'VARCHAR(10) NOT NULL UNIQUE',
        'report_type': 'VARCHAR(25)',
        'report_content': 'VARCHAR(4500)',
        'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    }
    commander.create_table("stock_reports", report_cols)
    
    print("===============================================")
    commander.list_tables()
    print("===============================================")
    
    # Example: Safe insert with upsert
    print("\nExample: Using enter_record (race-condition free)")
    commander.enter_record(
        "stock_indicators",
        {
            "symbol": "AAPL",
            "indicator_type": "RSI"
        }
    )
    
    # Query data
    data = commander.execute_query("SELECT * FROM stock_indicators")
    print(data)
    
    print("===============================================")
    # Uncomment to delete all tables
    commander.delete_all_tables()
    print("===============================================")