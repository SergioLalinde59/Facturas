from typing import List, Optional
import logging
from psycopg2.extras import RealDictCursor
from src.domain.models.tax import Tax
from src.domain.ports.tax_repository import TaxRepository
from src.infrastructure.database.connection import get_db_connection

logger = logging.getLogger("database")

class PostgresTaxRepository(TaxRepository):
    def save(self, tax: Tax) -> Tax:
        query = """
            INSERT INTO taxes (code, name, agrupacion_id, description)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                agrupacion_id = EXCLUDED.agrupacion_id,
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        """
        params = (tax.code, tax.name, tax.agrupacion_id, tax.description)
        
        try:
            # Consumir el generador get_db_connection
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, params)
                    result = cur.fetchone()
                    # El commit se hace automáticamente en el generador si no hay excepción
                    return self._map_row_to_tax(result)
            finally:
                # Asegurar que el generador se cierre (devuelva la conexión)
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error saving tax {tax.code}: {e}")
            raise

    def get_by_id(self, id: int) -> Optional[Tax]:
        query = """
            SELECT t.*, a.operation 
            FROM taxes t
            LEFT JOIN agrupaciones a ON t.agrupacion_id = a.id
            WHERE t.id = %s
        """
        
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (id,))
                    result = cur.fetchone()
                    if result:
                        return self._map_row_to_tax(result)
                    return None
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting tax by id {id}: {e}")
            raise

    def get_by_code(self, code: str) -> Optional[Tax]:
        query = """
            SELECT t.*, a.operation 
            FROM taxes t
            LEFT JOIN agrupaciones a ON t.agrupacion_id = a.id
            WHERE t.code = %s
        """
        
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (code,))
                    result = cur.fetchone()
                    if result:
                        return self._map_row_to_tax(result)
                    return None
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting tax {code}: {e}")
            raise

    def get_all(self) -> List[Tax]:
        query = """
            SELECT t.*, a.operation 
            FROM taxes t
            LEFT JOIN agrupaciones a ON t.agrupacion_id = a.id
            ORDER BY t.code
        """
        
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query)
                    results = cur.fetchall()
                    return [self._map_row_to_tax(row) for row in results]
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting all taxes: {e}")
            raise

    def update(self, tax: Tax) -> Tax:
        return self.save(tax) # Save handles update via ON CONFLICT

    def delete(self, code: str) -> bool:
        query = "DELETE FROM taxes WHERE code = %s RETURNING code"
        
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor() as cur:
                    cur.execute(query, (code,))
                    deleted = cur.fetchone()
                    return deleted is not None
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error deleting tax {code}: {e}")
            raise

    def _map_row_to_tax(self, row: dict) -> Tax:
        return Tax(
            id=row['id'],
            code=row['code'],
            name=row['name'],
            agrupacion_id=row.get('agrupacion_id'),
            operation=row.get('operation'), # From JOIN
            description=row.get('description')
        )
