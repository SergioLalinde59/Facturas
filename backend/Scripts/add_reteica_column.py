import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'Facturas'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '')
    )

def add_column():
    conn = get_connection()
    try:
        cur = conn.cursor()
        print("Adding 'reteica' column to 'facturas' table...")
        # Check if column exists
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='facturas' AND column_name='reteica';")
        if cur.fetchone():
            print("Column 'reteica' already exists.")
        else:
            cur.execute("ALTER TABLE facturas ADD COLUMN reteica NUMERIC(15, 2) DEFAULT 0.0;")
            conn.commit()
            print("Column 'reteica' added successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
        if conn:
            conn.rollback()
            conn.close()

if __name__ == "__main__":
    add_column()
