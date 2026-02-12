from typing import List, Optional
from abc import ABC, abstractmethod
from src.domain.models.grouping import Grouping

class GroupingRepository(ABC):
    @abstractmethod
    def save(self, grouping: Grouping) -> Grouping:
        pass

    @abstractmethod
    def get_by_id(self, id: int) -> Optional[Grouping]:
        pass

    @abstractmethod
    def get_all(self) -> List[Grouping]:
        pass

    @abstractmethod
    def update(self, grouping: Grouping) -> Grouping:
        pass

    @abstractmethod
    def delete(self, id: int) -> bool:
        pass
