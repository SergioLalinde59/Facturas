from fastapi import APIRouter, HTTPException, Depends
from typing import List
from src.domain.models.tax import Tax
from src.application.services.tax_service import TaxService
from src.infrastructure.database.postgres_tax_repository import PostgresTaxRepository

router = APIRouter(prefix="/api/taxes", tags=["Taxes"])

def get_tax_service():
    repository = PostgresTaxRepository()
    return TaxService(repository)

@router.get("/", response_model=List[Tax])
def list_taxes(service: TaxService = Depends(get_tax_service)):
    return service.list_taxes()

@router.get("/{code}", response_model=Tax)
def get_tax(code: str, service: TaxService = Depends(get_tax_service)):
    tax = service.get_tax(code)
    if not tax:
        raise HTTPException(status_code=404, detail="Tax not found")
    return tax

@router.post("/", response_model=Tax)
def create_tax(tax: Tax, service: TaxService = Depends(get_tax_service)):
    try:
        return service.create_tax(tax)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{code}", response_model=Tax)
def update_tax(code: str, tax: Tax, service: TaxService = Depends(get_tax_service)):
    if code != tax.code:
        raise HTTPException(status_code=400, detail="Code mismatch")
    try:
        return service.update_tax(tax)
    except Exception as e:
        # Assuming update fails if not found or other issues, though save upserts.
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{code}")
def delete_tax(code: str, service: TaxService = Depends(get_tax_service)):
    success = service.delete_tax(code)
    if not success:
        raise HTTPException(status_code=404, detail="Tax not found")
    return {"message": "Tax deleted successfully"}
