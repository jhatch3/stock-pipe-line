import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

class DBConnection:
    def __init__(self):
        # Make Sure These Match The Environment Params in docker-compose.yaml
        self.DB_PARAMS = {
            'host': 'localhost',
            'database': 'stock_db',
            'user': 'db_user',
            'password': 'db_password',
            'port': '5000'  
        }
        self.conn = self._init_con()
        self.cur = self._init_cur() if self.conn else None
        
        if self.cur:
            print("Database connection established successfully")
    
    def _init_con(self):
        try:
            conn = psycopg2.connect(**self.DB_PARAMS)
            print("Connection Successful!!")
            return conn
        except psycopg2.Error as e:
            print(f"Database connection error in _init_con(): {e}")
            return None
    
    def _init_cur(self):
        if not self.conn:
            print("Cannot create cursor: no valid connection")
            return None
        
        try:
            cur = self.conn.cursor()
            print("Cursor Connected!!")
            return cur
        except psycopg2.Error as e:
            print(f"Database cursor error in _init_cur(): {e}")
            return None
    
    def is_connected(self):
        """Check if the connection is still alive"""
        if not self.conn:
            return False
        try:
            cur = self.conn.cursor()
            cur.execute('SELECT 1')
            cur.close()
            return True
        except:
            return False
    
    def commit(self):
        """Commit the current transaction"""
        if self.conn:
            try:
                self.conn.commit()
            except psycopg2.Error as e:
                print(f"Commit error: {e}")
    
    def rollback(self):
        """Rollback the current transaction"""
        if self.conn:
            try:
                self.conn.rollback()
            except psycopg2.Error as e:
                print(f"Rollback error: {e}")

    
    def close(self):
        """close cursor and connection"""
        try:
            if self.cur:
                self.cur.close()
                print("Cursor closed")
        except Exception as e:
            print(f"Error closing cursor: {e}")
        
        try:
            if self.conn:
                self.conn.close()
                print("Connection closed")
        except Exception as e:
            print(f"Error closing connection: {e}")
    
    def __del__(self):
        """Destructor - cleanup resources"""
        print("Destructor called, closing resources")
        self.close()


if __name__ == "__main__":

    db = DBConnection()
    if db.is_connected():
        # Use the database
        print("Ready to execute queries")

    
