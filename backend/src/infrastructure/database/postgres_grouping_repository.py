from typing import List, Optional
import logging
from psycopg2.extras import RealDictCursor
from src.domain.models.grouping import Grouping
from src.domain.ports.grouping_repository import GroupingRepository
from src.infrastructure.database.connection import get_db_connection

logger = logging.getLogger("database")

class PostgresGroupingRepository(GroupingRepository):
    def save(self, grouping: Grouping) -> Grouping:
        query = """
            INSERT INTO agrupaciones (name, operation)
            VALUES (%s, %s)
            ON CONFLICT (name) DO UPDATE SET
                operation = EXCLUDED.operation
            RETURNING *;
        """
        params = (grouping.name, grouping.operation)
        
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, params)
                    result = cur.fetchone()
                    return self._map_row_to_grouping(result)
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error saving grouping {grouping.name}: {e}")
            raise

    def get_by_id(self, id: int) -> Optional[Grouping]:
        query = "SELECT * FROM agrupaciones WHERE id = %s"
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (id,))
                    result = cur.fetchone()
                    if result:
                        return self._map_row_to_grouping(result)
                    return None
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting grouping {id}: {e}")
            raise

    def get_all(self) -> List[Grouping]:
        query = "SELECT * FROM agrupaciones ORDER BY name"
        try:
            conn_gen = get_db_connection()
            conn = next(conn_gen)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query)
                    results = cur.fetchall()
                    return [self._map_row_to_grouping(row) for row in results]
            finally:
                try:
                    next(conn_gen)
                except StopIteration:
                    pass
        except Exception as e:
            logger.error(f"Error getting all groupings: {e}")
            raise

    def update(self, grouping: Grouping) -> Grouping:
        return self.save(grouping)

    def delete(self, id: int) -> bool:
        query = "DELETE FROM agrupaciones WHERE id = %s RETURNING id"
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
            logger.error(f"Error deleting grouping {id}: {e}")
            raise

    def _map_row_to_grouping(self, row: dict) -> Grouping:
        return Grouping(
            id=row['id'],
            name=row['name'],
            operation=row['operation']
        )
