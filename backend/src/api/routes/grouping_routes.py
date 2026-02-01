from fastapi import APIRouter, HTTPException, Depends
from typing import List
from src.domain.models.grouping import Grouping
from src.application.services.grouping_service import GroupingService
from src.infrastructure.database.postgres_grouping_repository import PostgresGroupingRepository

router = APIRouter(prefix="/api/groupings", tags=["Groupings"])

def get_grouping_service():
    repository = PostgresGroupingRepository()
    return GroupingService(repository)

@router.get("/", response_model=List[Grouping])
def list_groupings(service: GroupingService = Depends(get_grouping_service)):
    return service.list_groupings()

@router.get("/{id}", response_model=Grouping)
def get_grouping(id: int, service: GroupingService = Depends(get_grouping_service)):
    grouping = service.get_grouping(id)
    if not grouping:
        raise HTTPException(status_code=404, detail="Grouping not found")
    return grouping

@router.post("/", response_model=Grouping)
def create_grouping(grouping: Grouping, service: GroupingService = Depends(get_grouping_service)):
    try:
        return service.create_grouping(grouping)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{id}", response_model=Grouping)
def update_grouping(id: int, grouping: Grouping, service: GroupingService = Depends(get_grouping_service)):
    if id != grouping.id and grouping.id is not None:
        raise HTTPException(status_code=400, detail="ID mismatch")
    grouping.id = id
    try:
        return service.update_grouping(grouping)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id}")
def delete_grouping(id: int, service: GroupingService = Depends(get_grouping_service)):
    success = service.delete_grouping(id)
    if not success:
        raise HTTPException(status_code=404, detail="Grouping not found")
    return {"message": "Grouping deleted successfully"}
