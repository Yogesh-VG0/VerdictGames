# Verdict.Games Backend

This is the central API and background worker service for Verdict.Games, powering PC and Android game reviews.
Built with FastAPI, PostgreSQL, Redis, and Celery.

## Prerequisites
- Docker & Docker Compose
- Or locally: Python 3.11, PostgreSQL, Redis

## Quick Start (Docker)
1. Copy the environment file:
   `cp .env.example .env`
2. Run `docker-compose up --build -d`
3. The API will be available at `http://localhost:8000/api/v1`
4. The interactive API documentation (Swagger) is at `http://localhost:8000/api/v1/openapi.json` (or `/docs`).

## Local Development (Without Docker)
1. Create a virtual environment:
   `python -m venv venv`
   `source venv/bin/activate` or `.\venv\Scripts\activate` on Windows
2. Install dependencies:
   `pip install -r requirements.txt`
3. Update `.env` with your local Postgres URL and Redis URL.
4. Run migrations:
   `alembic upgrade head`
5. Start FastAPI:
   `uvicorn main:app --reload`
6. Start Celery Worker:
   `celery -A worker.celery_app worker --loglevel=info`

## Architecture
- `app/api/`: REST Endpoints powered by FastAPI
- `app/models/`: SQLAlchemy ORM definitions mapping to PostgreSQL
- `app/schemas/`: Pydantic Models for Data Validation
- `app/services/`: Interactions with 3rd-party APIs (RAWG, Steam API, PlayStore scraping)
- `worker/`: Async tasks offloaded to celery handling scrapes & rating recalculations.
