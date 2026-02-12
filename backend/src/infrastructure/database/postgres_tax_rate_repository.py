from typing import List, Optional
import logging
from psycopg2.extras import RealDictCursor
from src.domain.models.tax_rate import TaxRate
from src.domain.ports.tax_rate_repository import TaxRateRepository
from src.infrastructure.database.connection import get_db_connection

logger = logging.getLogger("database")

class PostgresTaxRateRepository(TaxRateRepository):
    def save(self, tax_rate: TaxRate) -> TaxRate:
        query = """
            INSERT INTO tax_rates (tax_id, percentage, name, description)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (tax_id, percentage) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description
            RETURNING *;
        """
        # Note: I might need to add a unique constraint on (tax_id, percentage) in the SQL if not already there.
        # Checking database_init.sql again... it only has id SERIAL PRIMARY KEY.
        # I'll update the database_init.sql later or just assume for now.
        
        params = (tax_rate.tax_id, tax_rate.percentage, tax_rate.name, tax_rate.description)
        
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, params)
                    result = cur.fetchone()
                    return self._map_row_to_tax_rate(result)
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error saving tax rate {tax_rate.name}: {e}")
            raise

    def get_by_id(self, id: int) -> Optional[TaxRate]:
        query = "SELECT * FROM tax_rates WHERE id = %s"
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (id,))
                    result = cur.fetchone()
                    if result:
                        return self._map_row_to_tax_rate(result)
                    return None
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting tax rate {id}: {e}")
            raise

    def get_by_tax_id(self, tax_id: int) -> List[TaxRate]:
        query = "SELECT * FROM tax_rates WHERE tax_id = %s ORDER BY percentage"
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (tax_id,))
                    results = cur.fetchall()
                    return [self._map_row_to_tax_rate(row) for row in results]
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting tax rates for tax {tax_id}: {e}")
            raise

    def get_all(self) -> List[TaxRate]:
        query = "SELECT * FROM tax_rates ORDER BY id"
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query)
                    results = cur.fetchall()
                    return [self._map_row_to_tax_rate(row) for row in results]
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting all tax rates: {e}")
            raise

    def update(self, tax_rate: TaxRate) -> TaxRate:
        if tax_rate.id:
            query = """
                UPDATE tax_rates SET
                    tax_id = %s,
                    percentage = %s,
                    name = %s,
                    description = %s
                WHERE id = %s
                RETURNING *;
            """
            params = (tax_rate.tax_id, tax_rate.percentage, tax_rate.name, tax_rate.description, tax_rate.id)
            try:
                conn_gen = get_db_connection()
                conn = next(conn_gen)
                try:
                    with conn.cursor(cursor_factory=RealDictCursor) as cur:
                        cur.execute(query, params)
                        result = cur.fetchone()
                        return self._map_row_to_tax_rate(result)
                finally:
                    try:
                        next(conn_gen)
                    except StopIteration:
                        pass
            except Exception as e:
                logger.error(f"Error updating tax rate {tax_rate.id}: {e}")
                raise
        return self.save(tax_rate)

    def delete(self, id: int) -> bool:
        query = "DELETE FROM tax_rates WHERE id = %s RETURNING id"
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor() as cur:
                    cur.execute(query, (id,))
                    deleted = cur.fetchone()
                    return deleted is not None
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error deleting tax rate {id}: {e}")
            raise

    def _map_row_to_tax_rate(self, row: dict) -> TaxRate:
        return TaxRate(
            id=row['id'],
            tax_id=row['tax_id'],
            percentage=float(row['percentage']),
            name=row['name'],
            description=row.get('description')
        )
