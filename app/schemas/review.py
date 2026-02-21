from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class ReviewBase(BaseModel):
    rating: float # 1-10
    text: Optional[str] = None
    device_specs: Optional[str] = None

class ReviewCreate(ReviewBase):
    game_id: int
    platform_id: int # ID of PC or ANDROID platform

class ReviewUpdate(BaseModel):
    rating: Optional[float] = None
    text: Optional[str] = None
    device_specs: Optional[str] = None

class ReviewInDBBase(ReviewBase):
    id: int
    user_id: int
    game_id: int
    platform_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Review(ReviewInDBBase):
    pass
