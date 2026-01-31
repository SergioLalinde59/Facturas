import os
import json
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
                (fecha, nit, proveedor, factura, subtotal, descuentos, 
                 iva_19, iva_5, iva_0, inc, inc_bolsas, retefuente, 
                 otros_impuestos, total, otros_conceptos, nombre_pdf, nombre_xml)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (nit, factura) DO UPDATE SET
                    subtotal = EXCLUDED.subtotal,
                    descuentos = EXCLUDED.descuentos,
                    iva_19 = EXCLUDED.iva_19,
                    iva_5 = EXCLUDED.iva_5,
                    iva_0 = EXCLUDED.iva_0,
                    inc = EXCLUDED.inc,
                    inc_bolsas = EXCLUDED.inc_bolsas,
                    retefuente = EXCLUDED.retefuente,
                    otros_impuestos = EXCLUDED.otros_impuestos,
                    total = EXCLUDED.total,
                    otros_conceptos = EXCLUDED.otros_conceptos,
                    nombre_pdf = EXCLUDED.nombre_pdf,
                    nombre_xml = EXCLUDED.nombre_xml
                RETURNING 1;
                """
                cur.execute(query, (
                    f['fecha'], f['nit'], f['proveedor'], f['factura'],
                    f.get('subtotal', 0), f.get('descuentos', 0),
                    f.get('iva_19', 0), f.get('iva_5', 0), f.get('iva_0', 0),
                    f.get('inc', 0), f.get('inc_bolsas', 0), f.get('retefuente', 0),
                    f.get('otros_impuestos', 0), f['total'],
                    json.dumps(f.get('otros_conceptos')) if f.get('otros_conceptos') else None,
                    f.get('nombre_pdf'), f.get('nombre_xml')
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

    def get_invoices(self, start_date: Optional[date] = None, end_date: Optional[date] = None, provider: Optional[str] = None) -> List[Dict[str, Any]]:
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = """
                SELECT fecha, nit, proveedor, factura, subtotal, descuentos, 
                       iva_19, iva_5, iva_0, inc, inc_bolsas, retefuente, 
                       otros_impuestos, total, otros_conceptos, nombre_pdf, nombre_xml, fecha_creacion
                FROM facturas
                """
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
                cur.execute(query, params)
                
                rows = cur.fetchall()
                result = []
                for row in rows:
                    result.append({
                        'fecha': str(row[0]),
                        'nit': row[1],
                        'proveedor': row[2],
                        'factura': row[3],
                        'subtotal': float(row[4] or 0),
                        'descuentos': float(row[5] or 0),
                        'iva_19': float(row[6] or 0),
                        'iva_5': float(row[7] or 0),
                        'iva_0': float(row[8] or 0),
                        'inc': float(row[9] or 0),
                        'inc_bolsas': float(row[10] or 0),
                        'retefuente': float(row[11] or 0),
                        'otros_impuestos': float(row[12] or 0),
                        'total': float(row[13] or 0),
                        'otros_conceptos': row[14],
                        'nombre_pdf': row[15],
                        'nombre_xml': row[16],
                        'fecha_creacion': str(row[17])
                    })
                return result
        finally:
            pool.putconn(conn)

    def check_exists(self, nit: str, factura: str) -> bool:
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
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = """
                SELECT 
                    COUNT(*) as total_facturas,
                    COALESCE(SUM(subtotal), 0) as total_subtotal,
                    COALESCE(SUM(descuentos), 0) as total_descuentos,
                    COALESCE(SUM(iva_19), 0) as total_iva_19,
                    COALESCE(SUM(iva_5), 0) as total_iva_5,
                    COALESCE(SUM(iva_0), 0) as total_iva_0,
                    COALESCE(SUM(inc), 0) as total_inc,
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
                    'total_iva_19': float(row[3] or 0),
                    'total_iva_5': float(row[4] or 0),
                    'total_iva_0': float(row[5] or 0),
                    'total_inc': float(row[6] or 0),
                    'total_monto': float(row[7] or 0),
                    'total_proveedores': row[8] or 0,
                    'total_nits': row[9] or 0,
                    'fecha_min': str(row[10]) if row[10] else None,
                    'fecha_max': str(row[11]) if row[11] else None
                }
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
