from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.tax import Tax

class TaxRepository(ABC):
    @abstractmethod
    def save(self, tax: Tax) -> Tax:
        """Guarda un impuesto en la base de datos."""
        pass

    @abstractmethod
    def get_by_id(self, id: int) -> Optional[Tax]:
        """Obtiene un impuesto por su ID."""
        pass

    @abstractmethod
    def get_by_code(self, code: str) -> Optional[Tax]:
        """Obtiene un impuesto por su código."""
        pass

    @abstractmethod
    def get_all(self) -> List[Tax]:
        """Obtiene todos los impuestos configurados."""
        pass

    @abstractmethod
    def update(self, tax: Tax) -> Tax:
        """Actualiza un impuesto existente."""
        pass

    @abstractmethod
    def delete(self, code: str) -> bool:
        """Elimina un impuesto por su código."""
        pass
