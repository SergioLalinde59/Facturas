from typing import List, Optional, Dict
from src.domain.models.tax import Tax
from src.domain.ports.tax_repository import TaxRepository

class TaxService:
    def __init__(self, tax_repository: TaxRepository):
        self.tax_repository = tax_repository

    def create_tax(self, tax: Tax) -> Tax:
        return self.tax_repository.save(tax)

    def get_tax(self, code: str) -> Optional[Tax]:
        return self.tax_repository.get_by_code(code)

    def list_taxes(self) -> List[Tax]:
        return self.tax_repository.get_all()

    def update_tax(self, tax: Tax) -> Tax:
        # Business logic validation could go here
        return self.tax_repository.update(tax)

    def delete_tax(self, code: str) -> bool:
        return self.tax_repository.delete(code)

    def initialize_taxes_from_config(self, config_data: Dict[str, Dict]):
        """
        Initializes taxes from a configuration dictionary (e.g. from JSON).
        Expected format: {'taxes': {'01': {...}, '02': {...}}}
        """
        taxes_config = config_data.get('taxes', {})
        results = []
        for code, data in taxes_config.items():
            tax = Tax(
                code=code,
                name=data['name'],
                agrupacion_id=data.get('agrupacion_id'),
                description=data.get('description')
            )
            saved_tax = self.tax_repository.save(tax)
            results.append(saved_tax)
        return results
