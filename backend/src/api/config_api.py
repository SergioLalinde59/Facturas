from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Any
from src.application.services.tax_configuration_service import TaxConfigurationService

router = APIRouter()

class TaxRule(BaseModel):
    code: str
    name: str
    type: str  # tax, withholding, info
    operation: str # add, subtract, ignore
    description: str

class TaxRulesRequest(BaseModel):
    rules: List[TaxRule]

@router.post("/tax-rules")
async def save_tax_rules(request: TaxRulesRequest):
    service = TaxConfigurationService()
    try:
        for rule in request.rules:
            service.add_rule(
                code=rule.code,
                name=rule.name,
                tax_type=rule.type,
                operation=rule.operation,
                description=rule.description
            )
        return {"status": "success", "message": "Reglas guardadas correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tax-rules")
async def get_tax_rules():
    service = TaxConfigurationService()
    return service.get_all_rules()
