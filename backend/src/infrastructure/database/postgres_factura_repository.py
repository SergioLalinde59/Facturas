import os
import json
from src.domain.ports.factura_repository import FacturaRepository
from src.infrastructure.database.connection import get_connection_pool
from datetime import date
from typing import List, Optional, Dict, Any

class PostgresFacturaRepository(FacturaRepository):
    def save(self, data: Dict[str, Any]) -> tuple[str, Optional[str]]:
        pool = get_connection_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # 1. UPSERT Header
                header_query = """
                INSERT INTO facturas 
                (fecha, nit, proveedor, factura, subtotal, descuentos, 
                 impuestos, retenciones, total, otros_impuestos, otros_conceptos, 
                 nombre_pdf, nombre_xml)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (nit, factura) DO UPDATE SET
                    fecha = EXCLUDED.fecha,
                    proveedor = EXCLUDED.proveedor,
                    subtotal = EXCLUDED.subtotal,
                    descuentos = EXCLUDED.descuentos,
                    impuestos = EXCLUDED.impuestos,
                    retenciones = EXCLUDED.retenciones,
                    total = EXCLUDED.total,
                    otros_impuestos = EXCLUDED.otros_impuestos,
                    otros_conceptos = EXCLUDED.otros_conceptos,
                    nombre_pdf = EXCLUDED.nombre_pdf,
                    nombre_xml = EXCLUDED.nombre_xml
                RETURNING id;
                """
                
                # Check if we are passing a dict or InvoiceMetadata (the service usually passes dict)
                # But let's be robust.
                
                cur.execute(header_query, (
                    data['fecha'], data['nit'], data['proveedor'], data['factura'],
                    data.get('subtotal', 0), data.get('descuentos', 0),
                    data.get('impuestos', 0), data.get('retenciones', 0),
                    data['total'], data.get('otros_impuestos', 0),
                    json.dumps(data.get('otros_conceptos')) if data.get('otros_conceptos') else None,
                    data.get('nombre_pdf'), data.get('nombre_xml')
                ))
                
                factura_id = cur.fetchone()[0]
                
                # 2. Sync Detalle
                # First delete existing (Simplified synchronization)
                cur.execute("DELETE FROM facturas_detalle WHERE factura_id = %s", (factura_id,))
                
                # Prepare detail rows
                tax_details = data.get('tax_details', []) # List of dicts or objects
                if tax_details:
                    detail_query = """
                    INSERT INTO facturas_detalle (fecha, factura_id, tax_id, tax_rate_id, percentage, valor)
                    VALUES (%s, %s, (SELECT id FROM taxes WHERE code = %s), %s, %s, %s)
                    """
                    for detail in tax_details:
                        # detail can be a dict (from API) or InvoiceTaxDetail (internal)
                        if hasattr(detail, 'tax_code'):
                             code = detail.tax_code
                             p = detail.percentage
                             v = detail.amount
                             r_id = getattr(detail, 'tax_rate_id', None)
                        else:
                             code = detail.get('tax_code')
                             p = detail.get('percentage', 0)
                             v = detail.get('amount', 0)
                             r_id = detail.get('tax_rate_id')
                             
                        cur.execute(detail_query, (
                            data['fecha'], factura_id, code, r_id, p, v
                        ))

            conn.commit()
            return 'inserted', None # Simplified status
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
                       impuestos, retenciones, otros_impuestos, total, 
                       otros_conceptos, nombre_pdf, nombre_xml, fecha_creacion
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
                        'impuestos': float(row[6] or 0),
                        'retenciones': float(row[7] or 0),
                        'otros_impuestos': float(row[8] or 0),
                        'total': float(row[9] or 0),
                        'otros_conceptos': row[10],
                        'nombre_pdf': row[11],
                        'nombre_xml': row[12],
                        'fecha_creacion': str(row[13])
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
                    COALESCE(SUM(impuestos), 0) as total_impuestos,
                    COALESCE(SUM(retenciones), 0) as total_retenciones,
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
                    'total_impuestos': float(row[3] or 0),
                    'total_retenciones': float(row[4] or 0),
                    'total_monto': float(row[5] or 0),
                    'total_proveedores': row[6] or 0,
                    'total_nits': row[7] or 0,
                    'fecha_min': str(row[8]) if row[8] else None,
                    'fecha_max': str(row[9]) if row[9] else None
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
