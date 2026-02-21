import json
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.core.redis import get_cached_response, cache_response
from app.models.game import Game, Platform
from app.schemas.game import PaginatedGames, GameDetail

router = APIRouter()

@router.get("/", response_model=PaginatedGames)
def read_games(
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort: Optional[str] = "trending",
    platform: Optional[str] = None,
) -> Any:
    cache_key = f"games_list:{request.url.query}"
    cached_data = get_cached_response(cache_key)
    if cached_data:
        return json.loads(cached_data)

    query = db.query(Game)
    # Simple sort mock, actual would join with GameRatingAggregate
    if sort == "newest":
        query = query.order_by(desc(Game.release_date))
    else:
        query = query.order_by(desc(Game.created_at))

    total = query.count()
    games = query.offset(skip).limit(limit).all()

    # Convert to Pydantic models for JSON serialization
    response_data = PaginatedGames(
        total=total,
        items=games
    )
    
    # Store in cache for 60 seconds
    cache_response(cache_key, response_data.model_dump_json(), expire_seconds=60)
    
    return response_data

@router.get("/{id}", response_model=GameDetail)
def read_game(
    id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    cache_key = f"game_detail:{id}"
    cached_data = get_cached_response(cache_key)
    if cached_data:
        return json.loads(cached_data)

    game = db.query(Game).filter(Game.id == id).first()
    if not game:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Game not found")
        
    response_data = GameDetail.model_validate(game)
    # Store in cache for 5 minutes
    cache_response(cache_key, response_data.model_dump_json(), expire_seconds=300)
    
    return response_data
