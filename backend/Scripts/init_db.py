import psycopg2
import os
from dotenv import load_dotenv

def create_facturas_table():
    # Cargar variables desde .env
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(env_path)
    
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5433'),
        'database': os.getenv('DB_NAME', 'Mvtos'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD')
    }
    
    print(f"Conectando a {db_config['database']} en {db_config['host']}...")
    
    conn = None
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # SQL para crear la tabla
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS facturas (
            id SERIAL PRIMARY KEY,
            fecha DATE NOT NULL,
            nit VARCHAR(20) NOT NULL,
            proveedor VARCHAR(255) NOT NULL,
            factura VARCHAR(50) NOT NULL,
            subtotal DECIMAL(15, 2) NOT NULL,
            iva DECIMAL(15, 2) NOT NULL,
            total DECIMAL(15, 2) NOT NULL,
            nombre_xml VARCHAR(255),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_factura UNIQUE (nit, factura)
        );
        """
        
        cur.execute(create_table_sql)
        conn.commit()
        print("Tabla 'facturas' creada o ya existente.")
        
    except Exception as e:
        print(f"Error al crear la tabla: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    create_facturas_table()
