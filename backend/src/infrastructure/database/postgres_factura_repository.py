import os
from src.domain.ports.factura_repository import FacturaRepository
from src.infrastructure.database.connection import get_connection_pool
from datetime import date
from typing import List, Optional, Dict, Any

class PostgresFacturaRepository(FacturaRepository):
    def save(self, f: Dict[str, Any]) -> tuple[str, Optional[str]]:
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = """
                INSERT INTO facturas 
                (fecha, nit, proveedor, factura, subtotal, descuentos, iva, total, nombre_xml)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (nit, factura) DO NOTHING
                RETURNING 1;
                """
                cur.execute(query, (
                    f['fecha'], f['nit'], f['proveedor'], f['factura'],
                    f['subtotal'], f.get('descuentos', 0), f['iva'], f['total'], f.get('nombre_xml')
                ))
                result = cur.fetchone()
                status = 'inserted' if result else 'updated'
            conn.commit()
            return status, None
        except Exception as e:
            conn.rollback()
            return 'error', str(e)
        finally:
            pool.putconn(conn)

    def get_distinct_providers(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[str]:
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT DISTINCT proveedor FROM facturas WHERE 1=1"
                params = []
                if start_date:
                    query += " AND fecha >= %s"
                    params.append(start_date)
                if end_date:
                    query += " AND fecha <= %s"
                    params.append(end_date)
                query += " ORDER BY proveedor"
                cur.execute(query, params)
                return [row[0] for row in cur.fetchall()]
        finally:
            pool.putconn(conn)

    def get_invoices(self, start_date: Optional[date] = None, end_date: Optional[date] = None, provider: Optional[str] = None) -> List[Dict[str, Any]]:
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT fecha, nit, proveedor, factura, subtotal, descuentos, iva, total, nombre_xml FROM facturas"
                params = []
                conditions = []

                if start_date:
                    conditions.append("fecha >= %s")
                    params.append(start_date)
                if end_date:
                    conditions.append("fecha <= %s")
                    params.append(end_date)
                if provider:
                    conditions.append("proveedor = %s")
                    params.append(provider)
                
                if conditions:
                    query += " WHERE " + " AND ".join(conditions)
                
                query += " ORDER BY fecha DESC, proveedor ASC"
                print(f"DEBUG SQL: {query} -- PARAMS: {params}")
                cur.execute(query, params)
                
                rows = cur.fetchall()
                print(f"DEBUG SQL RESULT: {len(rows)} records found")
                
                if len(rows) == 0:
                    cur.execute("SELECT count(*) FROM facturas")
                    total = cur.fetchone()[0]
                    print(f"DEBUG ADVERTENCIA: La consulta retorno 0, pero hay un TOTAL de {total} registros en la tabla 'facturas'")
                
                result = []
                for row in rows:
                    result.append({
                        'fecha': str(row[0]),
                        'nit': row[1],
                        'proveedor': row[2],
                        'factura': row[3],
                        'subtotal': float(row[4]),
                        'descuentos': float(row[5]),
                        'iva': float(row[6]),
                        'total': float(row[7]),
                        'nombre_xml': row[8]
                    })
                return result
        finally:
            pool.putconn(conn)

    def check_exists(self, nit: str, factura: str) -> bool:
        """Verifica si una factura ya existe en la base de datos."""
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT 1 FROM facturas WHERE nit = %s AND factura = %s"
                cur.execute(query, (nit, factura))
                return cur.fetchone() is not None
        finally:
            pool.putconn(conn)

    def get_stats(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> Dict[str, Any]:
        """Obtiene estadísticas agregadas de las facturas"""
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = """
                SELECT 
                    COUNT(*) as total_facturas,
                    COALESCE(SUM(subtotal), 0) as total_subtotal,
                    COALESCE(SUM(descuentos), 0) as total_descuentos,
                    COALESCE(SUM(iva), 0) as total_iva,
                    COALESCE(SUM(total), 0) as total_monto,
                    COUNT(DISTINCT proveedor) as total_proveedores,
                    COUNT(DISTINCT nit) as total_nits,
                    MIN(fecha) as fecha_min,
                    MAX(fecha) as fecha_max
                FROM facturas
                WHERE 1=1
                """
                params = []
                if start_date:
                    query += " AND fecha >= %s"
                    params.append(start_date)
                if end_date:
                    query += " AND fecha <= %s"
                    params.append(end_date)
                
                cur.execute(query, params)
                row = cur.fetchone()
                
                return {
                    'total_facturas': row[0] or 0,
                    'total_subtotal': float(row[1] or 0),
                    'total_descuentos': float(row[2] or 0),
                    'total_iva': float(row[3] or 0),
                    'total_monto': float(row[4] or 0),
                    'total_proveedores': row[5] or 0,
                    'total_nits': row[6] or 0,
                    'fecha_min': str(row[7]) if row[7] else None,
                    'fecha_max': str(row[8]) if row[8] else None
                }
        finally:
            pool.putconn(conn)
