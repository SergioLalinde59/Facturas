from dataclasses import dataclass
from typing import Optional

@dataclass
class InvoiceMetadata:
    invoice_number: str
    issue_date: str
    supplier_name: str
    nit: str
