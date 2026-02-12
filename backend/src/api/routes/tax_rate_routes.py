from fastapi import APIRouter, HTTPException, Depends
from typing import List
from src.domain.models.tax_rate import TaxRate
from src.application.services.tax_rate_service import TaxRateService
from src.infrastructure.database.postgres_tax_rate_repository import PostgresTaxRateRepository

router = APIRouter(prefix="/api/tax-rates", tags=["Tax Rates"])

def get_tax_rate_service():
    repository = PostgresTaxRateRepository()
    return TaxRateService(repository)

@router.get("/", response_model=List[TaxRate])
def list_tax_rates(service: TaxRateService = Depends(get_tax_rate_service)):
    return service.list_tax_rates()

@router.get("/by-tax/{tax_id}", response_model=List[TaxRate])
def get_tax_rates_by_tax(tax_id: int, service: TaxRateService = Depends(get_tax_rate_service)):
    return service.get_tax_rates_by_tax(tax_id)

@router.get("/{id}", response_model=TaxRate)
def get_tax_rate(id: int, service: TaxRateService = Depends(get_tax_rate_service)):
    rate = service.get_tax_rate(id)
    if not rate:
        raise HTTPException(status_code=404, detail="Tax Rate not found")
    return rate

@router.post("/", response_model=TaxRate)
def create_tax_rate(tax_rate: TaxRate, service: TaxRateService = Depends(get_tax_rate_service)):
    try:
        return service.create_tax_rate(tax_rate)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{id}", response_model=TaxRate)
def update_tax_rate(id: int, tax_rate: TaxRate, service: TaxRateService = Depends(get_tax_rate_service)):
    if id != tax_rate.id and tax_rate.id is not None:
        raise HTTPException(status_code=400, detail="ID mismatch")
    tax_rate.id = id
    try:
        return service.update_tax_rate(tax_rate)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id}")
def delete_tax_rate(id: int, service: TaxRateService = Depends(get_tax_rate_service)):
    success = service.delete_tax_rate(id)
    if not success:
        raise HTTPException(status_code=404, detail="Tax Rate not found")
    return {"message": "Tax Rate deleted successfully"}
