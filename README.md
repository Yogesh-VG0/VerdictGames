# verdict.games

**The Verdict on Every Game** — A premium game reviews platform built for players who want honest, no-nonsense opinions on PC and Android games. Think of it as a Letterboxd for games.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)

## Features

- **293+ games** with real data from RAWG, Steam, IGDB, CheapShark, and Wikipedia
- **Auto-discovery** — cron endpoint fetches trending, new, and top-rated games automatically
- **Rich game pages** — scores, verdict badges, pros/cons, pricing, media, external links
- **Search & filter** — by platform, genre, year, monetization, with full-text search
- **Curated lists** — hand-picked game collections
- **Community reviews** — user reviews with helpful voting
- **Responsive design** — mobile-first with pixel-art gaming aesthetic
- **Dark/Light mode** — toggleable theme
- **Smooth animations** — Framer Motion scroll-reveal, staggered grids, entrance transitions

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 with custom design tokens |
| Animation | Framer Motion |
| Database | Supabase (PostgreSQL) |
| Data Sources | RAWG API, Steam, IGDB/Twitch, CheapShark, Wikipedia |
| Deployment | Vercel-ready |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- A Supabase project
- RAWG API key (free at [rawg.io](https://rawg.io/apidocs))
- Twitch/IGDB credentials (free at [dev.twitch.tv](https://dev.twitch.tv/console))

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/Yogesh-VG0/VerdictGames.git
   cd VerdictGames
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and fill in your keys:
   ```bash
   cp .env.example .env
   ```

4. Apply the database schema:
   ```bash
   psql $DATABASE_URL -f supabase/schema.sql
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Ingest games:
   ```bash
   node scripts/ingest-full-library.mjs
   node scripts/seed-flags.mjs
   ```

### Auto-Discovery

Hit the cron endpoint to discover new games:
```
GET /api/cron/discover
```

This fetches trending, new releases, upcoming, top rated, and popular games from RAWG and ingests any that aren't already in the database.

## Project Structure

```
src/
├── app/              # Next.js App Router pages + API routes
│   ├── api/          # REST endpoints (search, ingest, cron, etc.)
│   ├── game/[slug]/  # Game detail page
│   ├── search/       # Search with filters
│   ├── reviews/      # Community reviews
│   ├── lists/        # Curated lists
│   └── ...
├── components/       # Reusable React components
├── lib/
│   ├── api.ts        # Client-side API functions
│   ├── external/     # RAWG, Steam, IGDB, CheapShark, Wikipedia clients
│   ├── services/     # Ingestion pipeline
│   ├── supabase/     # Database client + types
│   └── db/           # Row mappers
└── hooks/            # Custom React hooks
```

## License

This is a personal project. All game titles, trademarks, and copyrights belong to their respective owners.
