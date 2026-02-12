from typing import List, Optional
from abc import ABC, abstractmethod
from src.domain.models.tax_rate import TaxRate

class TaxRateRepository(ABC):
    @abstractmethod
    def save(self, tax_rate: TaxRate) -> TaxRate:
        pass

    @abstractmethod
    def get_by_id(self, id: int) -> Optional[TaxRate]:
        pass

    @abstractmethod
    def get_by_tax_id(self, tax_id: int) -> List[TaxRate]:
        pass

    @abstractmethod
    def get_all(self) -> List[TaxRate]:
        pass

    @abstractmethod
    def update(self, tax_rate: TaxRate) -> TaxRate:
        pass

    @abstractmethod
    def delete(self, id: int) -> bool:
        pass
