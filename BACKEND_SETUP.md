# verdict.games — Backend Setup Guide

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [RAWG](https://rawg.io/apidocs) API key (free)
- (Optional) A [Steam Web API](https://steamcommunity.com/dev/apikey) key

---

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL**, **anon key**, and **service_role key** from:
   - Settings → API → Project URL
   - Settings → API → Project API keys

---

## 2. Run Database Schema

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/schema.sql`
3. Run it — this creates all tables, indexes, triggers, and RLS policies

---

## 3. Set Environment Variables

```bash
cp .env.example .env.local
```

Fill in your values:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret!) |
| `RAWG_API_KEY` | https://rawg.io/apidocs |
| `STEAM_API_KEY` | https://steamcommunity.com/dev/apikey |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for dev |

---

## 4. Install & Run

```bash
npm install
npm run dev
```

The app starts at `http://localhost:3000`.

**Without Supabase configured**, the app automatically falls back to mock data — the frontend works exactly as before.

---

## 5. Test Ingestion

Once environment variables are set, ingest a game:

```bash
curl -X POST http://localhost:3000/api/ingest/game \
  -H "Content-Type: application/json" \
  -d '{"query": "Hades"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "success": true,
    "gameId": "uuid-here",
    "slug": "hades",
    "message": "Game \"Hades\" ingested successfully.",
    "alreadyExisted": false
  }
}
```

Then visit `http://localhost:3000/game/hades` to see it live.

### Batch Ingestion

```bash
curl -X POST http://localhost:3000/api/ingest/batch \
  -H "Content-Type: application/json" \
  -d '{"queries": ["Hades", "Elden Ring", "Stardew Valley", "Hollow Knight"]}'
```

---

## 6. API Routes Reference

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/games/trending` | Trending games |
| GET | `/api/games/new-releases` | Newest releases |
| GET | `/api/games/top-rated` | Highest-scored games |
| GET | `/api/search?q=&platform=&genre=&sort=&page=` | Search with filters |
| GET | `/api/games/[slug]` | Single game detail |
| GET | `/api/games/[slug]/reviews` | Reviews for a game |
| GET | `/api/games/[slug]/deals` | Price deals for a game |
| GET | `/api/games/[slug]/news` | Latest Steam news/patch notes |
| GET | `/api/games/[slug]/achievements` | Steam achievement stats |
| GET | `/api/reviews?sort=&platform=&page=` | Global review feed |
| GET | `/api/lists` | All curated lists |
| GET | `/api/lists/[slug]` | Single list with games |
| GET | `/api/profile/[username]` | User profile |
| POST | `/api/ingest/game` | Ingest single game |
| POST | `/api/ingest/batch` | Ingest multiple games |

All GET routes return `{ success: true, data: ... }` and fall back to mock data when Supabase is not configured.

---

## Architecture

```
src/
├── app/
│   └── api/                    # Next.js Route Handlers
│       ├── games/
│       │   ├── trending/
│       │   ├── new-releases/
│       │   ├── top-rated/
│       │   └── [slug]/
│       │       ├── route.ts    # GET game detail
│       │       └── reviews/
│       ├── search/
│       ├── reviews/
│       ├── lists/
│       │   └── [slug]/
│       ├── profile/
│       │   └── [username]/
│       └── ingest/
│           ├── game/           # POST single ingest
│           └── batch/          # POST batch ingest
├── lib/
│   ├── api/
│   │   └── response.ts        # JSON response helpers
│   ├── db/
│   │   └── mappers.ts         # DB row → frontend model
│   ├── external/
│   │   ├── rawg.ts            # RAWG API client
│   │   └── steam.ts           # Steam API client
│   ├── services/
│   │   └── ingest.ts          # Ingestion pipeline
│   ├── supabase/
│   │   ├── client.ts          # Browser client (anon key)
│   │   ├── server.ts          # Server client (service role)
│   │   ├── types.ts           # Database types
│   │   └── index.ts           # Barrel export
│   ├── utils/
│   │   ├── slugify.ts         # URL slug generator
│   │   └── score.ts           # Score → verdict mapping
│   ├── api.ts                 # Frontend API client (calls routes)
│   ├── mockData.ts            # Mock dataset (fallback)
│   ├── types.ts               # Frontend interfaces
│   └── utils.ts               # UI utilities
└── supabase/
    └── schema.sql              # Full database schema
```

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is **never** exposed to the client
- It's only used in `src/lib/supabase/server.ts`, which is only imported by Route Handlers
- RAWG and Steam API keys are also server-only
- All POST routes validate input and return 400 for bad requests
- Row Level Security is enabled on all tables

---

## Deploying to Vercel

1. Push to GitHub
2. Import into Vercel
3. Add all environment variables in Vercel dashboard → Settings → Environment Variables
4. Set `NEXT_PUBLIC_SITE_URL` to your production URL
5. Deploy

The app will automatically use Supabase in production and mock data locally if env vars are missing.
