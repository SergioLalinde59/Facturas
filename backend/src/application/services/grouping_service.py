from typing import List, Optional
from src.domain.models.grouping import Grouping
from src.domain.ports.grouping_repository import GroupingRepository

class GroupingService:
    def __init__(self, grouping_repository: GroupingRepository):
        self.grouping_repository = grouping_repository

    def create_grouping(self, grouping: Grouping) -> Grouping:
        return self.grouping_repository.save(grouping)

    def get_grouping(self, id: int) -> Optional[Grouping]:
        return self.grouping_repository.get_by_id(id)

    def list_groupings(self) -> List[Grouping]:
        return self.grouping_repository.get_all()

    def update_grouping(self, grouping: Grouping) -> Grouping:
        return self.grouping_repository.update(grouping)

    def delete_grouping(self, id: int) -> bool:
        return self.grouping_repository.delete(id)
