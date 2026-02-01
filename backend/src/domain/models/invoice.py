from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass
class InvoiceMetadata:
    invoice_number: str
    issue_date: str
    supplier_name: str
    nit: str
    subtotal: float = 0.0
    descuentos: float = 0.0
    iva_19: float = 0.0
    iva_5: float = 0.0
    iva_0: float = 0.0
    inc: float = 0.0
    inc_bolsas: float = 0.0
    retefuente: float = 0.0
    reteica: float = 0.0
    otros_impuestos: float = 0.0
    total: float = 0.0
    otros_conceptos: Optional[Dict[str, Any]] = None
    nombre_pdf: Optional[str] = None
    nombre_xml: Optional[str] = None
    validation_error: Optional[str] = None
