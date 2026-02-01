from pydantic import BaseModel
from typing import Optional

class Tax(BaseModel):
    id: Optional[int] = None
    code: str
    name: str
    agrupacion_id: Optional[int] = None
    operation: Optional[str] = None # Will be populated via JOIN
    description: Optional[str] = None
