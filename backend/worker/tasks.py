import asyncio
from worker.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.game import GameRatingAggregate, Game, GameSource, SteamMetadata, PlaystoreMetadata
from app.models.review import Review
from app.services.rawg import fetch_trending_games
from app.services.steam import fetch_steam_app_details
from app.services.playstore import fetch_playstore_metadata

@celery_app.task(name="worker.tasks.recalculate_rating_aggregates")
def recalculate_rating_aggregates(game_id: int):
    """
    Recalculates the aggregate scores for a particular game across PC and Android platforms.
    Executed async when a new review is added or modified.
    """
    db = SessionLocal()
    try:
        # Perform computation...
        aggregate = db.query(GameRatingAggregate).filter_by(game_id=game_id).first()
        if not aggregate:
            aggregate = GameRatingAggregate(game_id=game_id)
            db.add(aggregate)
        
        reviews = db.query(Review).filter_by(game_id=game_id).all()
        # Mock logic, typically you would SQL SUM/COUNT
        if len(reviews) > 0:
            total_score = sum(r.rating for r in reviews)
            aggregate.overall_rating = total_score / len(reviews)
            aggregate.overall_count = len(reviews)
            
        db.commit()
        return f"Recalculated game id: {game_id}, new score: {aggregate.overall_rating}"
    finally:
        db.close()

@celery_app.task(name="worker.tasks.sync_rawg_trending")
def sync_rawg_trending():
    """
    Nightly sync top games from RAWG into local database.
    """
    db = SessionLocal()
    try:
        # Using asyncio.run inside sync celery task to use httpx.AsyncClient
        games_data = asyncio.run(fetch_trending_games())
        count = 0
        for data in games_data:
            slug = data.get("slug")
            # Upsert logic here
            game = db.query(Game).filter_by(slug=slug).first()
            if not game:
                game = Game(
                    title=data.get("name"),
                    slug=slug,
                    release_date=data.get("released"),
                    cover_image=data.get("background_image")
                )
                db.add(game)
                db.commit()
                # Attach GameSource
                source = GameSource(game_id=game.id, rawg_id=data.get("id"))
                db.add(source)
                count += 1
        db.commit()
        return f"Synced {count} new trending games"
    finally:
        db.close()

@celery_app.task(name="worker.tasks.scrape_steam")
def scrape_steam(game_id: int, appid: str):
    """
    Syncs Steam Metadata for a specific match.
    """
    db = SessionLocal()
    try:
        details = asyncio.run(fetch_steam_app_details(appid))
        if details:
            meta = db.query(SteamMetadata).filter_by(game_id=game_id).first()
            if not meta:
                meta = SteamMetadata(game_id=game_id, appid=appid)
                db.add(meta)
            
            # Basic info injection
            meta.price = details.get("price_overview", {}).get("final")
            meta.raw_json = details
            db.commit()
            return f"Steam details synced for {appid}"
    finally:
        db.close()

@celery_app.task(name="worker.tasks.scrape_playstore", bind=True, max_retries=3)
def scrape_playstore(self, game_id: int, package: str):
    """
    Headless Playstore scrape, with exponential backoff on ban.
    """
    db = SessionLocal()
    try:
        meta_data = asyncio.run(fetch_playstore_metadata(package))
        if meta_data:
            meta = db.query(PlaystoreMetadata).filter_by(game_id=game_id).first()
            if not meta:
                meta = PlaystoreMetadata(game_id=game_id, package=package)
                db.add(meta)
            meta.raw_json = meta_data
            db.commit()
            return f"Playstore scraped for {package}"
        else:
            raise self.retry(countdown=2 ** self.request.retries)
    finally:
        db.close()
