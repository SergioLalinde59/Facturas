from pydantic import BaseModel
from typing import Optional

class Grouping(BaseModel):
    id: Optional[int] = None
    name: str
    operation: str # 'add', 'subtract', 'ignore'
