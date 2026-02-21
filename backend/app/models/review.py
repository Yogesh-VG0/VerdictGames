from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Review(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    game_id = Column(Integer, ForeignKey("game.id"), nullable=False)
    platform_id = Column(Integer, ForeignKey("platform.id"), nullable=False) # PC or Android
    
    rating = Column(Float, nullable=False) # 1-10
    text = Column(Text, nullable=True)
    device_specs = Column(String, nullable=True) # "RTX 3080, 32GB RAM" or "Pixel 7"
    
    is_flagged = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
    game = relationship("Game", back_populates="reviews")
    platform = relationship("Platform")
    likes = relationship("ReviewLike", back_populates="review", cascade="all, delete-orphan")

class ReviewLike(Base):
    __tablename__ = "review_likes"
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("review.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    
    review = relationship("Review", back_populates="likes")

class GameRatingAggregate(Base):
    __tablename__ = "game_rating_aggregates"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("game.id"), unique=True, nullable=False)
    
    overall_rating = Column(Float, default=0.0)
    overall_count = Column(Integer, default=0)
    
    pc_rating = Column(Float, default=0.0)
    pc_count = Column(Integer, default=0)
    
    android_rating = Column(Float, default=0.0)
    android_count = Column(Integer, default=0)
    
    trending_score = Column(Float, default=0.0)
    
    histogram_1 = Column(Integer, default=0)
    histogram_2 = Column(Integer, default=0)
    histogram_3 = Column(Integer, default=0)
    histogram_4 = Column(Integer, default=0)
    histogram_5 = Column(Integer, default=0)
    histogram_6 = Column(Integer, default=0)
    histogram_7 = Column(Integer, default=0)
    histogram_8 = Column(Integer, default=0)
    histogram_9 = Column(Integer, default=0)
    histogram_10 = Column(Integer, default=0)

    last_recalculated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    game = relationship("Game", back_populates="aggregates")
