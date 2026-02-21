from celery import Celery
import os

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")

celery_app = Celery(
    "verdict_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_BROKER_URL, # Or use DB backend if preferred
    include=['worker.tasks']
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    # Rate limit configurations to be respectful for scraping
    task_annotations={'worker.tasks.scrape_playstore': {'rate_limit': '5/m'}}
)

# Optional: define beat schedules here for nightly syncs
celery_app.conf.beat_schedule = {
    'sync-rawg-trending-nightly': {
        'task': 'worker.tasks.sync_rawg_trending',
        'schedule': 86400.0, # Every 24 hours
    },
}
