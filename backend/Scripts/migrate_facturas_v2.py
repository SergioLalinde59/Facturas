import psycopg2
import os
from dotenv import load_dotenv

def migrate_db():
    load_dotenv()
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5433'),
        'database': os.getenv('DB_NAME', 'Mvtos'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD')
    }
    
    conn = None
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # SQL para agregar columnas si no existen
        alter_table_sql = """
        ALTER TABLE facturas 
        ADD COLUMN IF NOT EXISTS inc DECIMAL(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS inc_bolsas DECIMAL(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS retefuente DECIMAL(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS otros_impuestos DECIMAL(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS otros_conceptos JSONB;
        """
        
        print("Ejecutando migración de base de datos...")
        cur.execute(alter_table_sql)
        conn.commit()
        print("Columnas adicionales añadidas exitosamente.")
        
    except Exception as e:
        print(f"Error en la migración: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    migrate_db()
