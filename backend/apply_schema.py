
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def apply_schema():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'Facturas'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'SLB')
        )
        cur = conn.cursor()
        
        with open('database_init.sql', 'r', encoding='utf-8') as f:
            sql = f.read()
            
        print("Executando SQL...")
        cur.execute(sql)
        conn.commit()
        print("Schema aplicado exitosamente.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    apply_schema()
