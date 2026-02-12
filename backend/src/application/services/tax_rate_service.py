from typing import List, Optional
from src.domain.models.tax_rate import TaxRate
from src.domain.ports.tax_rate_repository import TaxRateRepository

class TaxRateService:
    def __init__(self, tax_rate_repository: TaxRateRepository):
        self.tax_rate_repository = tax_rate_repository

    def create_tax_rate(self, tax_rate: TaxRate) -> TaxRate:
        return self.tax_rate_repository.save(tax_rate)

    def get_tax_rate(self, id: int) -> Optional[TaxRate]:
        return self.tax_rate_repository.get_by_id(id)

    def list_tax_rates(self) -> List[TaxRate]:
        return self.tax_rate_repository.get_all()
    
    def get_tax_rates_by_tax(self, tax_id: int) -> List[TaxRate]:
        return self.tax_rate_repository.get_by_tax_id(tax_id)

    def update_tax_rate(self, tax_rate: TaxRate) -> TaxRate:
        return self.tax_rate_repository.update(tax_rate)

    def delete_tax_rate(self, id: int) -> bool:
        return self.tax_rate_repository.delete(id)
