from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import date
from src.domain.models.invoice import InvoiceMetadata

class FacturaRepository(ABC):
    @abstractmethod
    def save(self, factura: dict) -> str:
        """Guarda una factura en la base de datos."""
        pass

    @abstractmethod
    def get_distinct_providers(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[str]:
        """Obtiene la lista de proveedores únicos filtrados por fecha."""
        pass

    @abstractmethod
    def get_invoices(self, start_date: Optional[date] = None, end_date: Optional[date] = None, provider: Optional[str] = None) -> List[dict]:
        """Obtiene facturas según filtros de fecha y proveedor."""
        pass
