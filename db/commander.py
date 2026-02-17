from DBConnection import DBConnection
import psycopg2

class Commander(DBConnection):
    def __init__(self):
        super().__init__()  # Initialize the parent DBConnection class
        
        if not self.is_connected():
            raise ConnectionError("Failed to establish database connection")
        
        print(f"Commander initialized with database connection")
    
    def execute_query(self, query, params=None):
        """Execute a query and return results"""
        if not self.cur:
            print("No cursor available")
            return None
        
        try:
            self.cur.execute(query, params)
            if query.strip().upper().startswith('SELECT'):
                return self.cur.fetchall()
            else:
                self.commit()
                return self.cur.rowcount
        except psycopg2.Error as e:
            print(f"Query execution error: {e}")
            self.rollback()
            return None

    def list_tables(self, show: bool = True):
        """
        List All Tables in the db
        
        SHOW == True -> Only prints tables, doesn't return
        SHOW == False -> Only returns that
        """
    
        tables = self.execute_query("""       
            SELECT table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
            AND table_schema NOT IN ('pg_catalog', 'information_schema');
            """)
        
        if tables:
            if show: 
                print("Tables in the database:")
                for table in tables:
                    print(f"- {table[0]}")
            return [table[0] for table in tables] 
        else:
            if show:
                print("No Tables in db")
            return []
       
    def create_table(self, table_name: str, cols: dict = None):
   
        try:
            if not cols:
                print("Cant Create Empty Table")
                return
            
            # Create the full query
            col_definitions = []
            for col_name, col_type in cols.items():
                col_definitions.append(f"{col_name} {col_type}")
            
    
            columns_sql = ", ".join(col_definitions)
            
            query = f"CREATE TABLE IF NOT EXISTS {table_name} ({columns_sql});"
            
            self.execute_query(query)
            print(f"Table '{table_name}' successfully created with columns: {list(cols.keys())}")
            
        except Exception as e:
            print(f"Error creating table '{table_name}': {e}")
        
    def enter_record(self, table_name: str, values: dict):
        
        try:
            if not table_name:
                print(f"Please Enter table_name:str")
            if not values:
                print(f"There are no values to be entered in {table_name}")
        
        except Exception as e:
            print(f"Error DELETING Table {table_name}: {e}")
    
    def delete_table(self, table_name: str):
        """Deletes any given table in the db"""
        try:
            self.execute_query(f"DROP TABLE IF EXISTS {table_name};")
            print(f"Table: {table_name} Successfully DELETED !!")
        except Exception as e: 
            print(f"Error DELETING Table {table_name}: {e}")
    
    def delete_all_tables(self):
        """Delete all tables in the database - use with caution!"""
        tables = self.list_tables(show=False)
        
        if tables:
            for table in tables:
                self.delete_table(table) 
    
    def __del__(self):
        """Clean up resources"""
        super().__del__()
        print("===============================================")
    
if __name__ == "__main__":
    print("===============================================")
    commander = Commander()
    # Example query
    if commander.is_connected():
        print("===============================================")
        commander.list_tables()
        print("===============================================")
    
        stock_cols = {
            'id': 'SERIAL PRIMARY KEY',
            'ticker': 'VARCHAR(10) NOT NULL UNIQUE',
            'company_name': 'VARCHAR(200)',
            'sector': 'VARCHAR(100)',
            'price': 'DECIMAL(10,2)',
            'volume': 'BIGINT',
            'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'

        }
        commander.create_table("Stock_Data", stock_cols)

        indicators_cols = {
            'id': 'SERIAL PRIMARY KEY',
            'ticker': 'VARCHAR(10) NOT NULL UNIQUE',
            'indicator_type': 'VARCHAR(25)',
            'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        }
        commander.create_table("Stock_Indicators", indicators_cols)

        ai_cols = {
            'id': 'SERIAL PRIMARY KEY',
            'ticker': 'VARCHAR(10) NOT NULL UNIQUE',
            'ai_SUMMARY': 'VARCHAR(4500)',
            'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        }
        commander.create_table("Stock_AI_Summary", ai_cols)

        report_cols = {
            'id': 'SERIAL PRIMARY KEY',
            'ticker': 'VARCHAR(10) NOT NULL UNIQUE',
            'report_type': 'VARCHAR(25)',
            'report_content': 'VARCHAR(4500)',
            'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        }
        commander.create_table("Stock_Reports", report_cols)

        print("===============================================")
        commander.list_tables()
        print("===============================================")
        print("===============================================")
        commander.delete_all_tables()
        print("===============================================")
