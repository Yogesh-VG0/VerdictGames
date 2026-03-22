# verdict.games

**The Verdict on Every Game** — A premium, data-driven game discovery and reviews platform. Think of it as a Letterboxd for games — enriched with data from 7 external APIs across all major platforms.

🌐 **Live**: [verdict.games](https://www.verdict.games)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-ff69b4?logo=framer)

## Features

- **1000+ games** with multi-source data from RAWG, Steam, IGDB, CheapShark, Wikipedia, HowLongToBeat & GX Corner
- **Auto-discovery** — Heroku scheduler discovers trending, new, and top-rated games daily
- **Rich game pages** — multi-source scoring (Verdict/Steam/IGDB/Metacritic), verdict badges, pros/cons, pricing, media, achievements, news
- **Search & filter** — 11 platforms (PC, PS5, PS4, Xbox, Switch, Android, iOS, Mac, Linux), genre, year, monetization, with full-text + RAWG fallback search
- **Release calendar** — merged GX + database data with platform filters and month navigation
- **Curated lists** — 10 editorial lists with overlap enforcement and unique thumbnails
- **Community reviews** — user reviews with helpful voting + Steam player reviews integration
- **Game comparison** — side-by-side game comparison with scores, stats, and HLTB data
- **Admin dashboard** — full game editor, source-specific reingest (RAWG/IGDB), audit log with field-level diffs
- **User library** — personal backlog with status tracking (playing/completed/wishlist/etc.)
- **Responsive design** — mobile-first with smooth horizontal scroll, native touch support
- **Dark/Light mode** — OLED-black dark theme with full light mode support
- **Smooth animations** — Framer Motion scroll-reveal, animated gradient text, cinematic hero transitions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.1 (App Router, Turbopack) |
| **Language** | TypeScript 5 (strict mode) |
| **Styling** | Tailwind CSS v4 with 50+ custom design tokens |
| **Animation** | Framer Motion 12 |
| **Database** | Supabase (PostgreSQL 17) with RLS |
| **Data Fetching** | TanStack React Query 5 |
| **Icons** | Lucide React |
| **Data Sources** | RAWG, Steam, IGDB/Twitch, CheapShark, Wikipedia, HLTB, GX Corner |
| **Hosting** | Vercel (frontend) + Heroku (scheduler) |
| **Analytics** | Vercel Analytics + Speed Insights |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Vercel     │────▶│  Supabase    │◀────│  Heroku         │
│  (Next.js)   │     │ (PostgreSQL) │     │  (Scheduler)    │
│  Frontend +  │     │  RLS + Auth  │     │  5 cron jobs     │
│  API Routes  │     └──────────────┘     └─────────────────┘
└──────┬───────┘            ▲
       │                    │
       ▼                    │
  ┌────────────────────────────────────┐
  │      7 External Data Sources       │
  │  RAWG · Steam · IGDB · CheapShark │
  │  Wikipedia · HLTB · GX Corner     │
  └────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project
- [RAWG API key](https://rawg.io/apidocs) (free, 20K requests/month)
- [Twitch/IGDB credentials](https://dev.twitch.tv/console) (free, 4 req/sec)

### Setup

1. **Clone & install**:
   ```bash
   git clone https://github.com/Yogesh-VG0/VerdictGames.git
   cd VerdictGames
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

   Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAWG_API_KEY`
   
   Optional: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `STEAM_API_KEY`, `CRON_SECRET`

3. **Apply database schema**:
   ```bash
   psql $DATABASE_URL -f supabase/schema.sql
   ```

4. **Start dev server**:
   ```bash
   npm run dev
   ```

5. **Ingest games**:
   ```bash
   node scripts/ingest-full-library.mjs    # ~300 curated games
   node scripts/seed-flags.mjs             # Set trending/featured flags
   node scripts/seed-curated-lists.mjs     # Create 10 editorial lists
   ```

### Heroku Scheduler Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `heroku-refresh-trending.mjs` | Hourly | Update trending/featured flags via IGDB PopScore |
| `heroku-discover-games.mjs` | Daily | Discover new games from RAWG |
| `heroku-re-enrich.mjs` | Hourly | Re-enrich stale game data |
| `seed-curated-lists.mjs` | Daily | Refresh editorial list content |
| `backfill-games.mjs` | Hourly | Backfill historical game data |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Homepage (hero, trending, discover, news)
│   ├── admin/              # Admin dashboard (games, reviews, users, audit)
│   ├── api/                # 40+ REST API routes
│   │   ├── admin/          # Protected admin endpoints
│   │   ├── cron/           # Scheduler endpoints
│   │   ├── games/          # Game CRUD + deals/news/achievements
│   │   ├── gx/             # GX Corner proxy (8 feeds)
│   │   └── ...
│   ├── game/[slug]/        # Game detail (richest page)
│   ├── search/             # Search with 5 filter types
│   ├── calendar/           # Release calendar with GX merge
│   ├── reviews/            # Community + Steam reviews
│   ├── lists/              # Curated game collections
│   ├── compare/            # Side-by-side game comparison
│   ├── library/            # Personal game backlog
│   └── profile/            # User profiles
├── components/             # 25+ React components
│   ├── ui/                 # Primitives (Skeleton, FilterChips, ScoreRing, etc.)
│   ├── HorizontalScroll    # Mouse-drag scroll with momentum
│   ├── HeroCarousel        # Cinematic auto-advancing carousel
│   ├── GameCard            # Default + spotlight variants
│   └── ...
├── lib/
│   ├── external/           # 7 API clients (RAWG, Steam, IGDB, etc.)
│   ├── services/           # 13-step ingestion pipeline
│   ├── supabase/           # Database client + typed schema
│   └── utils/              # Score, slug, platform helpers
├── hooks/                  # useAuth, useTheme
scripts/                    # 15+ Node.js CLI scripts
supabase/                   # Schema + 12 migrations
```

## Scoring Algorithm

The Verdict Score (0–100) uses a priority chain:

1. **Steam Review %** (preferred) — positive / total reviews × 100
2. **IGDB Aggregated Rating** — external critic average
3. **RAWG Metacritic** — Metacritic score from RAWG
4. **RAWG User Rating × 20** — scaled to 0–100

| Score | Verdict | Color |
|-------|---------|-------|
| 90–100 | MUST PLAY | 🟢 Green |
| 75–89 | WORTH IT | 🟡 Lime |
| 50–74 | MIXED | 🟠 Yellow |
| 0–49 | SKIP | 🔴 Red |

## Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for complete technical documentation covering every file, API route, database table, component, and algorithm.

See [BACKEND_SETUP.md](./BACKEND_SETUP.md) for Supabase + Heroku deployment guide.

## License

This is a personal project. All game titles, trademarks, and copyrights belong to their respective owners.
