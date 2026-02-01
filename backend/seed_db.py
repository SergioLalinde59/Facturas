
import os
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def seed_db():
    config_path = 'tax_config.json'
    if not os.path.exists(config_path):
        print("tax_config.json not found")
        return

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5433'),
            database=os.getenv('DB_NAME', 'Facturas'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'SLB')
        )
        cur = conn.cursor()

        # 1. Seed Agrupaciones (Already done in SQL but for safety)
        agrupaciones = [
            ('Descuentos', 'subtract'),
            ('Impuestos', 'add'),
            ('Retenciones', 'subtract'),
            ('Ignorar', 'ignore')
        ]
        for name, op in agrupaciones:
            cur.execute("INSERT INTO agrupaciones (name, operation) VALUES (%s, %s) ON CONFLICT (name) DO NOTHING", (name, op))

        # 2. Seed Taxes from config
        taxes_data = config.get('taxes', {})
        for code, info in taxes_data.items():
            # Find agrupacion_id
            name = info.get('name', '')
            t_type = info.get('type', 'tax')
            
            agr_name = 'Impuestos'
            if t_type == 'withholding':
                agr_name = 'Retenciones'
            elif name == 'Descuentos':
                agr_name = 'Descuentos'
            elif t_type == 'info':
                agr_name = 'Ignorar'
            
            cur.execute("SELECT id FROM agrupaciones WHERE name = %s", (agr_name,))
            agr_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO taxes (code, name, agrupacion_id, description)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    agrupacion_id = EXCLUDED.agrupacion_id
                RETURNING id
            """, (code, info['name'], agr_id, info.get('description')))
            
            tax_db_id = cur.fetchone()[0]
            
            # 3. Seed Basic Rates for IVA (01)
            if code == '01':
                rates = [
                    (19.0, 'IVA General 19%'),
                    (5.0, 'IVA 5%'),
                    (0.0, 'IVA 0% / Exento')
                ]
                for p, r_name in rates:
                    cur.execute("""
                        INSERT INTO tax_rates (tax_id, percentage, name)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (tax_db_id, p, r_name))

        conn.commit()
        print("Base de Datos seed exitoso.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error seeding DB: {e}")

if __name__ == "__main__":
    seed_db()
