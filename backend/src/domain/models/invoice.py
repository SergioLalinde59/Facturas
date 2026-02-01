from dataclasses import dataclass
from typing import Optional, Dict, Any, List

@dataclass
class InvoiceTaxDetail:
    tax_code: str  # '01', '03', etc.
    tax_name: str
    percentage: float
    amount: float
    tax_rate_id: Optional[int] = None

@dataclass
class InvoiceMetadata:
    invoice_number: str
    issue_date: str
    supplier_name: str
    nit: str
    subtotal: float = 0.0
    descuentos: float = 0.0
    impuestos: float = 0.0
    retenciones: float = 0.0
    total: float = 0.0
    otros_impuestos: float = 0.0
    
    # Detalle normalizado
    tax_details: List[InvoiceTaxDetail] = None
    
    otros_conceptos: Optional[List[Dict[str, Any]]] = None # [{"name": "...", "amount": ..., "operation": "add|subtract"}]
    nombre_pdf: Optional[str] = None
    nombre_xml: Optional[str] = None
    validation_error: Optional[str] = None

    def __post_init__(self):
        if self.tax_details is None:
            self.tax_details = []
        if self.otros_conceptos is None:
            self.otros_conceptos = []
