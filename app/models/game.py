from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Game(Base):
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    cover_image = Column(String, nullable=True)
    release_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    platforms = relationship("GamePlatform", back_populates="game")
    sources = relationship("GameSource", back_populates="game")
    reviews = relationship("Review", back_populates="game")
    aggregates = relationship("GameRatingAggregate", back_populates="game", uselist=False)

class GameSource(Base):
    __tablename__ = "game_sources"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("game.id"))
    rawg_id = Column(Integer, unique=True, index=True, nullable=True)
    igdb_id = Column(Integer, unique=True, index=True, nullable=True)
    steam_appid = Column(String, unique=True, index=True, nullable=True)
    playstore_package = Column(String, unique=True, index=True, nullable=True)

    game = relationship("Game", back_populates="sources")

class Platform(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # e.g. "PC", "ANDROID"

    game_platforms = relationship("GamePlatform", back_populates="platform")

class GamePlatform(Base):
    __tablename__ = "game_platforms"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("game.id"))
    platform_id = Column(Integer, ForeignKey("platform.id"))
    
    store_url = Column(String, nullable=True)

    game = relationship("Game", back_populates="platforms")
    platform = relationship("Platform", back_populates="game_platforms")

class SteamMetadata(Base):
    __tablename__ = "steam_metadata"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("game.id"))
    appid = Column(String, unique=True, index=True)
    price = Column(Float, nullable=True)
    supported_languages = Column(String, nullable=True)
    screenshots = Column(JSON, nullable=True)
    raw_json = Column(JSON, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PlaystoreMetadata(Base):
    __tablename__ = "playstore_metadata"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("game.id"))
    package = Column(String, unique=True, index=True)
    installs = Column(String, nullable=True)
    rating_count = Column(Integer, nullable=True)
    price = Column(String, nullable=True)
    ads_flag = Column(Boolean, nullable=True)
    iap_flag = Column(Boolean, nullable=True)
    raw_json = Column(JSON, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
