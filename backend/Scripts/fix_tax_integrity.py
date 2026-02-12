
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def migrate():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'Facturas'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'SLB')
        )
        cur = conn.cursor()

        print("Iniciando migración de integridad de impuestos...")

        # 1. Asegurar que las agrupaciones básicas existen con los IDs esperados o nombres
        # Usaremos nombres para ser más seguros
        groupings = {
            'Descuentos': 'subtract',
            'Impuestos': 'add',
            'Retenciones': 'subtract',
            'Ignorar': 'ignore'
        }
        
        agr_map = {}
        for name, op in groupings.items():
            cur.execute("INSERT INTO agrupaciones (name, operation) VALUES (%s, %s) ON CONFLICT (name) DO UPDATE SET operation = EXCLUDED.operation RETURNING id", (name, op))
            agr_map[name] = cur.fetchone()[0]

        print(f"Mapeo de agrupaciones: {agr_map}")

        # 2. Actualizar agrupacion_id en taxes basándose en la lógica actual
        print("Actualizando agrupacion_id en la tabla taxes...")
        
        # Impuestos (Suman)
        cur.execute("UPDATE taxes SET agrupacion_id = %s WHERE (type = 'tax' AND operation = 'add') OR (code IN ('01', '02', '03', '04', '08', '09', '11', '12', '13', '14', '15', '22'))", (agr_map['Impuestos'],))
        
        # Retenciones (Restan)
        cur.execute("UPDATE taxes SET agrupacion_id = %s WHERE type = 'withholding' OR operation = 'subtract' OR code IN ('05', '06', '07')", (agr_map['Retenciones'],))
        
        # Informativos (Ignoran)
        cur.execute("UPDATE taxes SET agrupacion_id = %s WHERE type = 'info' OR operation = 'ignore' OR code = '10'", (agr_map['Ignorar'],))

        # 3. Eliminar columnas redundantes
        print("Eliminando columnas redundantes type y operation...")
        cur.execute("ALTER TABLE taxes DROP COLUMN IF EXISTS type")
        cur.execute("ALTER TABLE taxes DROP COLUMN IF EXISTS operation")

        conn.commit()
        print("Migración completada con éxito.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error durante la migración: {e}")
        if 'conn' in locals():
            conn.rollback()

if __name__ == "__main__":
    migrate()
