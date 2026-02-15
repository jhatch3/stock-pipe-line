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

    def list_tables(self):
        """ List All Tables in the db"""
    
        tables = self.execute_query("""       
            SELECT table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
            AND table_schema NOT IN ('pg_catalog', 'information_schema');
            """)
        
        if tables:
            print("Tables in the database:")
            for table in tables:
                print(f"- {table[0]}")

        else:
            print("No Tables in db")
    
        return tables

        
    def create_table(self, table_name:str):
            """ 
            Create table with the name table_names 
            
            TODO: enter params for cols
            """
            try:
                self.execute_query(f"CREATE TABLE {table_name} ( id SERIAL PRIMARY KEY);")
                print(f"Table: {table_name} Successfully Created !!")
            except None:
                print(f"Error Creating Table {table_name}")

    def delete_table(self, table_name:str):
            """ Deletes any given table in the db"""
            try:
                self.execute_query(f"DROP TABLE IF EXISTS {table_name};")
                print(f"Table: {table_name} Successfully DELETED !!")
            except None:
                print(f"Error DELETING Table {table_name}")
    
    def __del__(self):
        """ Deletes all tables and also closses cur / conn"""
        tables = self.list_tables()

        for table in tables:
            print(self.delete_table(table[0]))

        return super().__del__()
    
if __name__ == "__main__":
    commander = Commander()
    
    # Example query
    if commander.is_connected():
        results = commander.execute_query("SELECT version();")
        if results:
            print(f"Database version: {results[0][0]}")
    
        commander.list_tables()
        commander.create_table("stock")
        commander.create_table("crypto")

    