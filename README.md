# Verdict.Games

This is the full-stack application for Verdict.Games, powering PC and Android game reviews.

## Components

- **Backend**: FastAPI, PostgreSQL, Redis, and Celery
- **Frontend**: Vite + React with Vercel Web Analytics integration

## Prerequisites

### Backend
- Docker & Docker Compose
- Or locally: Python 3.11, PostgreSQL, Redis

### Frontend
- Node.js 18+ and npm (or pnpm, yarn, bun)

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

### Backend
- `app/api/`: REST Endpoints powered by FastAPI
- `app/models/`: SQLAlchemy ORM definitions mapping to PostgreSQL
- `app/schemas/`: Pydantic Models for Data Validation
- `app/services/`: Interactions with 3rd-party APIs (RAWG, Steam API, PlayStore scraping)
- `worker/`: Async tasks offloaded to celery handling scrapes & rating recalculations

### Frontend
- `frontend/`: Vite + React application with Vercel Web Analytics
- See [frontend/README.md](frontend/README.md) for detailed frontend documentation
