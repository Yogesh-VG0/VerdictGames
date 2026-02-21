from typing import Optional, List, Any
from pydantic import BaseModel
from datetime import datetime

class PlatformSchema(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class GameRatingAggregateSchema(BaseModel):
    overall_rating: float
    overall_count: int
    pc_rating: float
    pc_count: int
    android_rating: float
    android_count: int
    trending_score: float
    class Config:
        from_attributes = True

class GameBase(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    release_date: Optional[datetime] = None

class GameInList(GameBase):
    id: int
    aggregates: Optional[GameRatingAggregateSchema] = None
    
    class Config:
        from_attributes = True

class GameDetail(GameInList):
    # Extending with metadata (could be rawg or steam/playstore data)
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Normally we would include nested models for platforms and sources but keeping simple here
    class Config:
        from_attributes = True

class PaginatedGames(BaseModel):
    total: int
    items: List[GameInList]
