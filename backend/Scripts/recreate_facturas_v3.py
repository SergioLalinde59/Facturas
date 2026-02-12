import psycopg2
import os
from dotenv import load_dotenv

def recreate_db():
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
        
        # Eliminar si existe y recrear con el orden solicitado
        sql = """
        DROP TABLE IF EXISTS facturas;
        
        CREATE TABLE facturas (
            id SERIAL PRIMARY KEY,
            fecha DATE NOT NULL,
            nit VARCHAR(20) NOT NULL,
            proveedor VARCHAR(255) NOT NULL,
            factura VARCHAR(50) NOT NULL,
            subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
            descuentos DECIMAL(15, 2) NOT NULL DEFAULT 0,
            iva_19 DECIMAL(15, 2) NOT NULL DEFAULT 0,
            iva_5 DECIMAL(15, 2) NOT NULL DEFAULT 0,
            iva_0 DECIMAL(15, 2) NOT NULL DEFAULT 0,
            inc DECIMAL(15, 2) NOT NULL DEFAULT 0,
            inc_bolsas DECIMAL(15, 2) NOT NULL DEFAULT 0,
            retefuente DECIMAL(15, 2) NOT NULL DEFAULT 0,
            otros_impuestos DECIMAL(15, 2) NOT NULL DEFAULT 0,
            total DECIMAL(15, 2) NOT NULL DEFAULT 0,
            otros_conceptos JSONB,
            nombre_pdf VARCHAR(255),
            nombre_xml VARCHAR(255),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_factura UNIQUE (nit, factura)
        );
        """
        
        print("Recreando tabla 'facturas' con la nueva estructura...")
        cur.execute(sql)
        conn.commit()
        print("✓ Tabla recreada exitosamente.")
        
    except Exception as e:
        print(f"Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    recreate_db()
