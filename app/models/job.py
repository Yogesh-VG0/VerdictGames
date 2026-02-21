from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.db.base import Base

class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"
    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String, index=True, nullable=False) # e.g. "RAWG_SYNC", "STEAM_MATCH", "PLAYSTORE_SCRAPE"
    status = Column(String, default="PENDING") # PENDING, RUNNING, COMPLETED, FAILED
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    target_id = Column(String, nullable=True) # e.g. game_id or source_id being processed
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_run = Column(DateTime(timezone=True), nullable=True)

class IngestionLog(Base):
    __tablename__ = "ingestion_logs"
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, index=True, nullable=False) # e.g. RAWG, STEAM, PLAYSTORE
    event = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
