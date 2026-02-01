from pydantic import BaseModel
from typing import Optional

class TaxRate(BaseModel):
    id: Optional[int] = None
    tax_id: int
    percentage: float
    name: str
    description: Optional[str] = None
