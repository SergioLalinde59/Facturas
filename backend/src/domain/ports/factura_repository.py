from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import date
from src.domain.models.invoice import InvoiceMetadata

class FacturaRepository(ABC):
    @abstractmethod
    def save(self, factura: dict) -> tuple[str, Optional[str]]:
        """Guarda una factura en la base de datos. Retorna (status, message)"""
        pass

    @abstractmethod
    def get_distinct_providers(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[str]:
        """Obtiene la lista de proveedores únicos filtrados por fecha."""
        pass

    @abstractmethod
    def check_exists(self, nit: str, factura: str) -> bool:
        """Verifica si una factura ya existe en la base de datos."""
        pass

    @abstractmethod
    def get_invoices(self, start_date: Optional[date] = None, end_date: Optional[date] = None, provider: Optional[str] = None) -> List[dict]:
        """Obtiene facturas según filtros de fecha y proveedor."""
        pass

    @abstractmethod
    def get_stats(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
        """Obtiene estadísticas de las facturas en el repositorio."""
        pass
