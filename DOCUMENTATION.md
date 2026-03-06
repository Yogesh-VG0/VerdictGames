# verdict.games — Complete Project Documentation

> **The Verdict on Every Game** — A premium game reviews and discovery platform built for players who want honest, data-driven opinions on PC and Android games. Think of it as a Letterboxd for games, enriched with data from 5+ external APIs.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Configuration Files](#4-configuration-files)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema (Supabase)](#6-database-schema-supabase)
   - [Tables](#61-tables)
   - [Indexes](#62-indexes)
   - [Triggers](#63-triggers)
   - [Row Level Security (RLS)](#64-row-level-security-rls)
   - [Migrations](#65-migrations)
7. [External Data Sources](#7-external-data-sources)
   - [RAWG API](#71-rawg-api)
   - [Steam API](#72-steam-api)
   - [IGDB / Twitch API](#73-igdb--twitch-api)
   - [CheapShark API](#74-cheapshark-api)
   - [Wikipedia REST API](#75-wikipedia-rest-api)
8. [Backend — API Routes](#8-backend--api-routes)
   - [Game Routes](#81-game-routes)
   - [Search Route](#82-search-route)
   - [Review Routes](#83-review-routes)
   - [List Routes](#84-list-routes)
   - [Profile Route](#85-profile-route)
   - [Ingestion Routes](#86-ingestion-routes)
   - [Cron Routes](#87-cron-routes)
9. [Ingestion Pipeline](#9-ingestion-pipeline)
10. [Frontend — Pages](#10-frontend--pages)
    - [Home Page](#101-home-page)
    - [Game Detail Page](#102-game-detail-page)
    - [Search Page](#103-search-page)
    - [Reviews Page](#104-reviews-page)
    - [Lists Page](#105-lists-page)
    - [Profile Page](#106-profile-page)
    - [Static Pages (About, Privacy, Terms)](#107-static-pages)
11. [Frontend — Components](#11-frontend--components)
    - [Layout Components](#111-layout-components)
    - [Display Components](#112-display-components)
    - [UI Primitives](#113-ui-primitives)
12. [Design System](#12-design-system)
    - [Color Tokens](#121-color-tokens)
    - [Typography](#122-typography)
    - [Animations & Transitions](#123-animations--transitions)
    - [Visual Effects](#124-visual-effects)
13. [State Management & Data Fetching](#13-state-management--data-fetching)
14. [Theming (Dark / Light Mode)](#14-theming-dark--light-mode)
15. [Client-Side API Layer](#15-client-side-api-layer)
16. [TypeScript Types](#16-typescript-types)
17. [Utility Functions](#17-utility-functions)
18. [Scripts](#18-scripts)
19. [SEO & Metadata](#19-seo--metadata)
20. [Deployment](#20-deployment)
21. [Security](#21-security)
22. [Scoring Algorithm](#22-scoring-algorithm)
23. [Complete File Reference](#23-complete-file-reference)

---

## 1. Project Overview

**verdict.games** is a full-stack, production-ready game reviews platform that aggregates data from multiple external APIs to provide comprehensive game profiles with:

- **293+ games** in the database with data from RAWG, Steam, IGDB, CheapShark, and Wikipedia
- **Auto-discovery** — cron endpoints that find and ingest trending, new, and top-rated games automatically
- **Rich game pages** — multi-source scoring, verdict badges, pros/cons, pricing, media, external links, achievements, news
- **Search & filter** — by platform, genre, year, monetization, with full-text search and on-demand ingestion
- **Curated lists** — hand-picked game collections
- **Community reviews** — user reviews with helpful voting and pros/cons
- **Responsive design** — mobile-first with a pixel-art gaming aesthetic
- **Dark/Light mode** — toggleable with localStorage persistence
- **Smooth animations** — Framer Motion scroll-reveal, staggered grids, carousel transitions, hover effects

### How It Works (High Level)

1. Games are **ingested** from RAWG (primary source) and **enriched** with data from Steam, IGDB, CheapShark, and Wikipedia
2. All data is stored in **Supabase (PostgreSQL)** with Row Level Security
3. The **Next.js App Router** serves both the frontend and API routes
4. The frontend fetches data via **React Query + internal API routes**
5. **Cron jobs** keep the database fresh by discovering new games and updating trending/featured flags

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js (App Router) | 16.1.6 | SSR, API routes, file-based routing |
| **Language** | TypeScript | 5.x | Strict mode, full type safety |
| **React** | React | 19.2.3 | UI rendering with latest features |
| **Styling** | Tailwind CSS | v4 | Utility-first CSS with custom design tokens |
| **Animation** | Framer Motion | 12.34.4 | Scroll-reveal, transitions, hover effects, carousels |
| **Database** | Supabase (PostgreSQL) | 2.98.0 | Data storage with RLS, triggers |
| **Data Fetching** | TanStack React Query | 5.90.21 | Client-side caching, deduplication, refetching |
| **Analytics** | Vercel Analytics | 1.6.1 | Page view tracking |
| **Performance** | Vercel Speed Insights | 1.3.1 | Core Web Vitals monitoring |
| **Fonts** | Geist Sans + Geist Mono | — | Google Fonts via `next/font` |
| **Build** | Turbopack | — | Fast dev server bundling |
| **Linting** | ESLint | 9.x | Next.js + TypeScript rules |
| **PostCSS** | @tailwindcss/postcss | 4.x | Tailwind CSS compilation |

### Runtime Dependencies

```
@supabase/supabase-js    — Supabase client library
@tanstack/react-query    — Async state management
@vercel/analytics        — Page analytics
@vercel/speed-insights   — Performance monitoring
framer-motion            — Animation library
next                     — React framework
react / react-dom        — UI library
```

### Dev Dependencies

```
@tailwindcss/postcss     — Tailwind CSS PostCSS plugin
@types/node              — Node.js type definitions
@types/react             — React type definitions
@types/react-dom         — React DOM type definitions
dotenv                   — Environment variable loading (scripts)
eslint / eslint-config-next — Linting
postgres                 — Direct PostgreSQL client (for scripts)
tailwindcss              — Utility CSS framework
typescript               — Language compiler
```

---

## 3. Project Structure

```
verdict-games/
├── BACKEND_SETUP.md            # Backend setup guide
├── DOCUMENTATION.md            # This file
├── Procfile                    # Heroku web process: npm run start
├── README.md                   # Project overview + quick start
├── eslint.config.mjs           # ESLint 9 flat config
├── next-env.d.ts               # Next.js TypeScript declarations
├── next.config.ts              # Next.js configuration (image domains)
├── package.json                # Dependencies, scripts, engines
├── postcss.config.mjs          # PostCSS with Tailwind CSS v4
├── tsconfig.json               # TypeScript config (strict, bundler resolution)
├── vercel.json                 # Vercel framework hint
│
├── public/                     # Static assets (favicon, OG images)
│
├── scripts/                    # Node.js CLI scripts for DB operations
│   ├── apply-migration-001.mjs
│   ├── apply-schema.mjs
│   ├── heroku-discover-games.mjs
│   ├── heroku-refresh-trending.mjs
│   ├── ingest-full-library.mjs
│   ├── migrate-players-updated-at.mjs
│   ├── migrate-score-columns.mjs
│   ├── refresh-all-games.mjs
│   ├── refresh-games.mjs
│   └── seed-flags.mjs
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (fonts, nav, providers)
│   │   ├── page.tsx            # Homepage (hero, trending, new, top-rated)
│   │   ├── providers.tsx       # QueryClient + ThemeProvider
│   │   ├── error.tsx           # Global error boundary
│   │   ├── loading.tsx         # Root loading skeleton
│   │   ├── globals.css         # Design system tokens + CSS utilities
│   │   ├── robots.ts           # robots.txt generation
│   │   ├── sitemap.ts          # Dynamic sitemap generation
│   │   │
│   │   ├── api/                # API route handlers
│   │   │   ├── cron/
│   │   │   │   ├── discover/route.ts        # GET — auto-discover games
│   │   │   │   └── refresh-trending/route.ts # GET — update trending flags
│   │   │   ├── games/
│   │   │   │   ├── [slug]/
│   │   │   │   │   ├── route.ts             # GET — single game detail
│   │   │   │   │   ├── achievements/route.ts # GET — Steam achievements
│   │   │   │   │   ├── deals/route.ts       # GET — price deals
│   │   │   │   │   ├── news/route.ts        # GET — Steam news
│   │   │   │   │   └── reviews/route.ts     # GET — game reviews
│   │   │   │   ├── new-releases/route.ts    # GET — newest games
│   │   │   │   ├── top-rated/route.ts       # GET — highest-scored
│   │   │   │   └── trending/route.ts        # GET — trending games
│   │   │   ├── ingest/
│   │   │   │   ├── game/route.ts            # POST — ingest single game
│   │   │   │   └── batch/route.ts           # POST — batch ingest
│   │   │   ├── lists/
│   │   │   │   ├── route.ts                 # GET — all curated lists
│   │   │   │   └── [slug]/route.ts          # GET — single list
│   │   │   ├── profile/
│   │   │   │   └── [username]/route.ts      # GET — user profile
│   │   │   ├── reviews/route.ts             # GET — global reviews feed
│   │   │   └── search/route.ts              # GET — search with filters
│   │   │
│   │   ├── game/[slug]/                     # Game detail page
│   │   │   ├── layout.tsx                   # SEO metadata generation
│   │   │   ├── loading.tsx                  # Loading skeleton
│   │   │   └── page.tsx                     # Full game detail UI
│   │   │
│   │   ├── search/                          # Search page
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── reviews/                         # Global reviews page
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── lists/                           # Curated lists page
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx              # Single list detail
│   │   │
│   │   ├── profile/[username]/              # User profile page
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── about/page.tsx                   # About page
│   │   ├── privacy/page.tsx                 # Privacy policy
│   │   └── terms/page.tsx                   # Terms of service
│   │
│   ├── components/                          # Reusable React components
│   │   ├── BottomNav.tsx                    # Mobile bottom navigation
│   │   ├── FadeInSection.tsx                # Scroll-reveal animation wrapper
│   │   ├── FeaturedHero.tsx                 # Static featured game hero
│   │   ├── GameCard.tsx                     # Game card (default + spotlight)
│   │   ├── GameGrid.tsx                     # Animated game grid with stagger
│   │   ├── HeroCarousel.tsx                 # Auto-advancing hero carousel
│   │   ├── HorizontalScroll.tsx             # Horizontal scroll with arrows
│   │   ├── MediaCarousel.tsx                # Image gallery with thumbnails
│   │   ├── NavbarTop.tsx                    # Top navigation bar
│   │   ├── ReviewCard.tsx                   # Review display card
│   │   ├── ScoreChips.tsx                   # Multi-source score badges
│   │   ├── SectionHeader.tsx                # Section title with "See all" link
│   │   ├── ThemeToggle.tsx                  # Dark/light mode toggle button
│   │   └── ui/                              # Primitive UI components
│   │       ├── FilterChips.tsx              # Radio-style chip selector
│   │       ├── PixelBadge.tsx               # Colored label badge
│   │       ├── PixelButton.tsx              # Styled button with variants
│   │       ├── PixelCard.tsx                # Card container with effects
│   │       ├── ScoreRing.tsx                # Animated SVG circular score
│   │       ├── Skeleton.tsx                 # Loading skeleton components
│   │       ├── SortDropdown.tsx             # Styled select dropdown
│   │       ├── Tabs.tsx                     # Tab navigation with animation
│   │       └── VerdictBadge.tsx             # Verdict label badge
│   │
│   ├── hooks/
│   │   └── useTheme.tsx                     # Theme context + localStorage
│   │
│   └── lib/                                 # Core application logic
│       ├── api.ts                           # Client-side API functions
│       ├── types.ts                         # Frontend TypeScript interfaces
│       ├── utils.ts                         # UI utilities (score colors, formatting)
│       ├── api/
│       │   └── response.ts                  # JSON response helpers (jsonOk, jsonError)
│       ├── db/
│       │   └── mappers.ts                   # DB row → frontend model mappers
│       ├── external/
│       │   ├── cheapshark.ts                # CheapShark API client
│       │   ├── igdb.ts                      # IGDB/Twitch API client
│       │   ├── rawg.ts                      # RAWG API client
│       │   ├── steam.ts                     # Steam API client
│       │   └── wikipedia.ts                 # Wikipedia REST API client
│       ├── services/
│       │   └── ingest.ts                    # Multi-source ingestion pipeline
│       ├── supabase/
│       │   ├── client.ts                    # Browser Supabase client (anon key)
│       │   ├── index.ts                     # Barrel export
│       │   ├── server.ts                    # Server Supabase client (service_role)
│       │   └── types.ts                     # Database type definitions
│       └── utils/
│           ├── score.ts                     # Score-to-verdict mapping (server-safe)
│           └── slugify.ts                   # URL slug generator
│
└── supabase/
    ├── schema.sql                           # Full database schema DDL
    └── migrations/
        ├── 001_multi_source.sql             # Multi-source enrichment columns
        └── 002_security_lint_fixes.sql      # Security lint fixes
```

---

## 4. Configuration Files

### `package.json`
- **Engine requirements**: Node.js ≥ 18, npm ≥ 9
- **Scripts**:
  - `dev` — Start dev server with Turbopack (`next dev`)
  - `build` — Production build (`next build`)
  - `start` — Production server on `$PORT` (`next start -p $PORT`)
  - `lint` — Run ESLint
  - `heroku-postbuild` — Build on Heroku deploy
  - `scheduler:trending` — Heroku scheduler: refresh trending flags
  - `scheduler:discover` — Heroku scheduler: discover new games

### `next.config.ts`
- **Image remote patterns** — Whitelists image domains:
  - `media.rawg.io` — RAWG game artwork
  - `cdn.akamai.steamstatic.com`, `steamcdn-a.akamaihd.net`, `store.steampowered.com` — Steam assets
  - `img.youtube.com` — YouTube trailer thumbnails
  - `images.igdb.com` — IGDB cover art
  - `upload.wikimedia.org` — Wikipedia images
  - `picsum.photos`, `fastly.picsum.photos` — Placeholder images

### `tsconfig.json`
- **Target**: ES2017
- **Module**: esnext (bundler resolution)
- **Strict mode**: Enabled
- **Path aliases**: `@/*` → `./src/*`
- **JSX**: react-jsx

### `eslint.config.mjs`
- ESLint 9 flat config format
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`

### `postcss.config.mjs`
- Uses `@tailwindcss/postcss` plugin for Tailwind CSS v4

### `vercel.json`
- Framework hint: `nextjs`

### `Procfile`
- Heroku process: `web: npm run start`

---

## 5. Environment Variables

| Variable | Required | Where Used | Description |
|----------|----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client | Supabase anonymous key (public, limited by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Supabase service role key (bypasses RLS) |
| `RAWG_API_KEY` | Yes | Server only | RAWG.io API key for game metadata |
| `STEAM_API_KEY` | Optional | Server only | Steam Web API key (for achievements) |
| `TWITCH_CLIENT_ID` | Optional | Server only | Twitch/IGDB OAuth client ID |
| `TWITCH_CLIENT_SECRET` | Optional | Server only | Twitch/IGDB OAuth client secret |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Client + Server | Base URL (e.g., `https://www.verdict.games`) |
| `CRON_SECRET` | Optional | Server only | Secret for authenticating cron/ingest endpoints |
| `DATABASE_URL` | Scripts only | CLI scripts | Direct PostgreSQL connection string |

**Graceful degradation**: If Supabase environment variables are missing, all API routes return empty data arrays instead of errors, and the frontend renders gracefully with empty states.

---

## 6. Database Schema (Supabase)

The database runs on Supabase-managed PostgreSQL with the `pgcrypto` extension for UUID generation.

### 6.1 Tables

#### `profiles`
User profile data.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PRIMARY KEY |
| `username` | TEXT | — | NOT NULL, UNIQUE |
| `display_name` | TEXT | `''` | NOT NULL |
| `avatar_url` | TEXT | `''` | NOT NULL |
| `bio` | TEXT | `''` | NOT NULL |
| `favorite_genres` | TEXT[] | `'{}'` | NOT NULL |
| `joined_at` | TIMESTAMPTZ | `now()` | NOT NULL |
| `updated_at` | TIMESTAMPTZ | `now()` | NOT NULL (auto-updated via trigger) |

#### `games`
Core game data — the largest table with 50+ columns spanning base metadata and multi-source enrichment.

| Column | Type | Default | Constraints / Notes |
|--------|------|---------|---------------------|
| `id` | UUID | `gen_random_uuid()` | PRIMARY KEY |
| `slug` | TEXT | — | NOT NULL, UNIQUE |
| `title` | TEXT | — | NOT NULL |
| `subtitle` | TEXT | — | Nullable |
| `cover_image` | TEXT | `''` | NOT NULL |
| `header_image` | TEXT | `''` | NOT NULL |
| `screenshots` | TEXT[] | `'{}'` | NOT NULL |
| `platforms` | TEXT[] | `'{}'` | NOT NULL — `["PC", "Android"]` |
| `genres` | TEXT[] | `'{}'` | NOT NULL |
| `tags` | TEXT[] | `'{}'` | NOT NULL |
| `developer` | TEXT | `''` | NOT NULL |
| `publisher` | TEXT | `''` | NOT NULL |
| `release_date` | DATE | — | Nullable |
| `description` | TEXT | `''` | NOT NULL — best source from Wiki/IGDB/RAWG |
| `score` | INTEGER | `0` | NOT NULL, CHECK 0–100 |
| `verdict_label` | TEXT | `'MIXED'` | NOT NULL — `MUST PLAY` / `WORTH IT` / `MIXED` / `SKIP` |
| `verdict_summary` | TEXT | `''` | NOT NULL — auto-generated summary |
| `pros` | TEXT[] | `'{}'` | NOT NULL — auto-generated from signals |
| `cons` | TEXT[] | `'{}'` | NOT NULL — auto-generated from signals |
| `monetization` | TEXT | `'Free'` | NOT NULL |
| `performance_notes` | TEXT | `''` | NOT NULL |
| `monetization_notes` | TEXT | `''` | NOT NULL |
| `steam_url` | TEXT | — | Nullable |
| `play_store_url` | TEXT | — | Nullable |
| `review_count` | INTEGER | `0` | NOT NULL |
| `user_score` | INTEGER | — | Nullable — Steam review % |
| `featured` | BOOLEAN | `false` | NOT NULL |
| `trending` | BOOLEAN | `false` | NOT NULL |
| `rawg_id` | INTEGER | — | Nullable — RAWG game ID |
| `steam_app_id` | INTEGER | — | Nullable — Steam App ID |

**Multi-Source Enrichment Columns (Migration 001):**

| Column | Type | Notes |
|--------|------|-------|
| `price_current` | INTEGER | Cents (e.g., 2999 = $29.99) |
| `price_currency` | TEXT | Default `'USD'` |
| `price_lowest` | INTEGER | All-time lowest price in cents |
| `price_deal_url` | TEXT | CheapShark redirect URL |
| `is_free` | BOOLEAN | Default `false` |
| `current_players` | INTEGER | Live Steam player count |
| `peak_players_24h` | INTEGER | Peak in last 24h |
| `players_updated_at` | TIMESTAMPTZ | When player count was last fetched |
| `trailer_url` | TEXT | YouTube URL from IGDB |
| `trailer_thumbnail` | TEXT | YouTube thumbnail image |
| `igdb_id` | INTEGER | IGDB game ID |
| `igdb_url` | TEXT | IGDB page URL |
| `igdb_rating` | REAL | IGDB aggregated rating 0–100 |
| `igdb_summary` | TEXT | IGDB storyline/summary |
| `wikipedia_url` | TEXT | Wikipedia page URL |
| `wikipedia_excerpt` | TEXT | Short Wikipedia description |
| `metacritic_url` | TEXT | Metacritic page URL |
| `website_url` | TEXT | Official game website |
| `reddit_url` | TEXT | Reddit community URL |
| `cheapshark_id` | TEXT | CheapShark game ID |
| `steam_rating_label` | TEXT | e.g., "Very Positive" |
| `rawg_metacritic` | INTEGER | Metacritic score from RAWG |
| `rawg_rating` | REAL | RAWG user rating (0–5) |
| `score_source` | TEXT | Which source the score came from |
| `last_enriched_at` | TIMESTAMPTZ | When multi-source enrichment ran |
| `enrichment_sources` | TEXT[] | Which sources contributed data |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` (auto-updated via trigger) |

#### `game_sources`
Maps each game to its external source IDs and caches raw API responses.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `game_id` | UUID | FK → `games(id)` ON DELETE CASCADE |
| `source_name` | TEXT | `'rawg'`, `'steam'`, `'igdb'`, `'cheapshark'` |
| `source_game_id` | TEXT | External ID as string |
| `source_url` | TEXT | Nullable — URL to external page |
| `last_synced_at` | TIMESTAMPTZ | When last synced |
| `raw_data` | JSONB | Nullable — cached raw API response |
| `created_at` | TIMESTAMPTZ | `now()` |

**Unique constraint**: `(source_name, source_game_id)` — prevents duplicate source entries.

#### `reviews`
User-submitted game reviews.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `game_id` | UUID | FK → `games(id)` ON DELETE CASCADE |
| `profile_id` | UUID | FK → `profiles(id)` ON DELETE CASCADE |
| `rating` | INTEGER | CHECK 0–100 |
| `title` | TEXT | Default `''` |
| `body` | TEXT | Default `''` |
| `pros` | TEXT[] | Default `'{}'` |
| `cons` | TEXT[] | Default `'{}'` |
| `platform` | TEXT | Default `'PC'` |
| `helpful` | INTEGER | Default `0` — upvote count |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` (auto-updated via trigger) |

#### `lists`
Curated game collections.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `slug` | TEXT | UNIQUE |
| `title` | TEXT | NOT NULL |
| `description` | TEXT | Default `''` |
| `cover_image` | TEXT | Default `''` |
| `curated_by` | TEXT | Default `''` — username |
| `tags` | TEXT[] | Default `'{}'` |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` (auto-updated via trigger) |

#### `list_items`
Join table linking lists to games with ordering.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `list_id` | UUID | FK → `lists(id)` ON DELETE CASCADE |
| `game_id` | UUID | FK → `games(id)` ON DELETE CASCADE |
| `position` | INTEGER | Default `0` — ordering within list |
| `added_at` | TIMESTAMPTZ | `now()` |

**Unique constraint**: `(list_id, game_id)` — prevents duplicate games in a list.

### 6.2 Indexes

```
idx_profiles_username          — profiles(username)
idx_games_slug                 — games(slug)
idx_games_score                — games(score DESC)
idx_games_trending             — games(trending) WHERE trending = true
idx_games_featured             — games(featured) WHERE featured = true
idx_games_release_date         — games(release_date DESC)
idx_games_rawg_id              — games(rawg_id) WHERE rawg_id IS NOT NULL
idx_games_steam_app_id         — games(steam_app_id) WHERE steam_app_id IS NOT NULL
idx_games_igdb_id              — games(igdb_id) WHERE igdb_id IS NOT NULL
idx_games_cheapshark_id        — games(cheapshark_id) WHERE cheapshark_id IS NOT NULL
idx_games_current_players      — games(current_players DESC NULLS LAST)
idx_games_is_free              — games(is_free) WHERE is_free = true
idx_games_last_enriched        — games(last_enriched_at NULLS FIRST)
idx_game_sources_unique        — game_sources(source_name, source_game_id) UNIQUE
idx_game_sources_game_id       — game_sources(game_id)
idx_reviews_game_id            — reviews(game_id)
idx_reviews_profile_id         — reviews(profile_id)
idx_reviews_created_at         — reviews(created_at DESC)
idx_reviews_helpful            — reviews(helpful DESC)
idx_lists_slug                 — lists(slug)
idx_list_items_list_id         — list_items(list_id)
idx_list_items_game_id         — list_items(game_id)
idx_list_items_unique          — list_items(list_id, game_id) UNIQUE
```

### 6.3 Triggers

A single trigger function `update_updated_at_column()` automatically sets `updated_at = now()` on UPDATE for:
- `games`
- `profiles`
- `reviews`
- `lists`

The function uses `SET search_path = ''` to prevent search_path injection attacks.

### 6.4 Row Level Security (RLS)

RLS is enabled on **all 6 tables**. Policies:

**Read policies** (public — `FOR SELECT USING (true)`):
- All tables permit public reads (games, profiles, reviews, lists, list_items, game_sources)

**Write policies** (service_role only — `TO service_role`):
- INSERT, UPDATE, DELETE restricted to `service_role` (used only in server-side Route Handlers)
- Anonymous and authenticated users cannot write directly to any table

### 6.5 Migrations

**Migration 001: `001_multi_source.sql`**
- Adds 25+ columns to `games` table for multi-source enrichment:
  - Price & deals (CheapShark + Steam)
  - Player counts (Steam)
  - Trailer media (IGDB/YouTube)
  - IGDB cross-reference (rating, summary, URL)
  - Wikipedia excerpt and URL
  - Additional external links (Metacritic, official website, Reddit)
  - Per-source score columns (Steam rating label, RAWG metacritic, RAWG rating, score_source)
  - Enrichment tracking (last_enriched_at, enrichment_sources)
- Creates 5 new partial indexes

**Migration 002: `002_security_lint_fixes.sql`**
- Fixes Supabase linter warnings:
  - `function_search_path_mutable` — pins `search_path = ''` on trigger function
  - `rls_policy_always_true` — rescopes service write policies to `TO service_role`

---

## 7. External Data Sources

### 7.1 RAWG API
**File**: `src/lib/external/rawg.ts`
**Base URL**: `https://api.rawg.io/api`
**Auth**: API key via query parameter
**Rate limit**: Free tier, 20,000 requests/month

**Functions**:
| Function | Purpose |
|----------|---------|
| `searchRawg(query, page, pageSize)` | Search games by name |
| `getRawgGame(id)` | Get full game details (description, developers, publishers, stores) |
| `getRawgScreenshots(id)` | Get game screenshots |
| `getRawgStoreLinks(gameId)` | Get actual store URLs (Steam, Play Store, etc.) |
| `extractSteamAppId(stores, storeLinks)` | Parse Steam App ID from store links |
| `extractPlayStoreUrl(stores, storeLinks)` | Parse Google Play URL from store links |
| `mapRawgPlatforms(platforms)` | Map RAWG platform slugs to `["PC", "Android"]` |

**Used for**: Primary game metadata source during ingestion, auto-discovery categories, search page results count.

### 7.2 Steam API
**File**: `src/lib/external/steam.ts`
**Base URLs**:
- Store API: `https://store.steampowered.com/api` (no key required)
- Web API: `https://api.steampowered.com` (some endpoints need key)

**Functions**:
| Function | Key Required | Purpose |
|----------|-------------|---------|
| `getSteamAppDetails(appId)` | No | Price, description, genres, screenshots |
| `getSteamReviewSummary(appId)` | No | Positive/negative review counts, score label |
| `getSteamPlayerCount(appId)` | No | Current concurrent player count |
| `getSteamNews(appId, count, maxLength)` | No | Latest news/patch notes |
| `getSteamAchievementSchema(appId)` | Yes | Achievement names, descriptions, icons |
| `getSteamGlobalAchievements(appId)` | No | Global unlock percentages |
| `getSteamAchievements(appId)` | Yes + No | Merged schema + percentages, sorted by unlock % |
| `extractSteamPrice(appData)` | — | Extract price in cents from app details |
| `steamScoreToPercent(positive, total)` | — | Convert review counts to percentage |
| `steamStoreUrl(appId)` | — | Build store page URL |

**Cache strategy**: 5 min for player counts, 30 min for reviews, 1h for details/screenshots, 24h for achievement schema.

### 7.3 IGDB / Twitch API
**File**: `src/lib/external/igdb.ts`
**Base URL**: `https://api.igdb.com/v4`
**Auth**: Twitch OAuth client credentials → Bearer token (cached in memory, ~60 day lifespan)
**Rate limit**: 4 requests/second
**Query language**: Apicalypse (SQL-like POST body)

**Functions**:
| Function | Purpose |
|----------|---------|
| `getIgdbToken()` | Obtain/cache Twitch OAuth bearer token |
| `igdbQuery<T>(endpoint, body)` | Execute Apicalypse query |
| `searchIgdb(query, limit)` | Search games by name |
| `getIgdbGame(igdbId)` | Full game details by ID |
| `findIgdbMatch(title, releaseYear)` | Best match for ingestion |
| `extractIgdbEnrichment(game)` | Extract trailer URL, Wikipedia URL, Reddit, official site |
| `getPopularByType(popularityType, limit)` | PopScore primitives (visits, want-to-play, playing, Steam peak) |
| `getIgdbGamesByIds(ids, limit)` | Batch game lookup by IDs |
| `getTrendingFromIgdb(limit)` | Combined PopScore trending (weighted: visits 25%, want-to-play 30%, playing 30%, Steam peak 15%) |
| `igdbImageUrl(imageId, size)` | Build IGDB image URL |
| `isIgdbConfigured()` | Check if Twitch credentials are available |

**PopScore popularity types**: 1=IGDB Visits, 2=Want to Play, 3=Playing, 4=Played, 5=Steam 24hr Peak, 6=Steam Positive Reviews, 7=Steam Negative Reviews, 8=Steam Total Reviews

**Optional integration**: Gracefully returns `null` if Twitch credentials are not configured.

### 7.4 CheapShark API
**File**: `src/lib/external/cheapshark.ts`
**Base URL**: `https://www.cheapshark.com/api/1.0`
**Auth**: None required (free API)

**Functions**:
| Function | Purpose |
|----------|---------|
| `searchCheapShark(title, limit)` | Search games by title |
| `getCheapSharkGame(gameId)` | Full game info with all current deals + cheapest-ever price |
| `getCheapSharkDeals(options)` | Get deals filtered by Steam App ID, store, page, sort |
| `findCheapSharkDeal(title, steamAppId)` | Find best deal for ingestion (returns price in cents) |
| `getStoreName(storeId)` | Map store ID → name (Steam, GOG, Epic, Humble, etc.) |
| `cheapSharkDealUrl(dealId)` | Build redirect URL |

**Store ID mapping includes**: Steam (1), GreenManGaming (3), GOG (7), Humble Store (11), Epic Games Store (25), and 15+ more stores.

**Cache**: 30 minutes for all requests.

### 7.5 Wikipedia REST API
**File**: `src/lib/external/wikipedia.ts`
**Base URL**: `https://en.wikipedia.org/api/rest_v1`
**Auth**: None required
**User-Agent**: `VerdictGames/1.0`

**Functions**:
| Function | Purpose |
|----------|---------|
| `getWikiSummary(title)` | Get plain text summary for a Wikipedia page |
| `findGameWikiSummary(gameTitle)` | Try multiple title variants (`"Game (video game)"`, `"Game"`, `"Game (game)"`) and verify it's game-related using keyword heuristics |

**Validation**: Checks for game-related keywords (video game, developed, published, gameplay, player, release, console, etc.) to avoid non-game pages.

**Cache**: 24 hours.

---

## 8. Backend — API Routes

All API routes follow a consistent pattern:
1. Check if Supabase environment variables are configured
2. If not configured, return empty data/arrays (graceful fallback)
3. If configured, query Supabase using the server client (service_role key)
4. Map database rows to frontend models using `mapGameRow`, `mapReviewRow`, etc.
5. Return `{ success: true, data: ... }` envelope via `jsonOk()`
6. Catch errors and return empty data or `{ success: false, error: "..." }` via `jsonError()`

### 8.1 Game Routes

#### `GET /api/games/trending`
- Returns games with `trending = true`, ordered by score descending
- **Fallback**: If no trending games, returns games from the last 3 years ordered by score
- **Query params**: `limit` (default: 10)

#### `GET /api/games/new-releases`
- Returns games released within the last 2 years, by release date descending
- **Fallback**: Widens to 5 years if insufficient results
- **Query params**: `limit` (default: 8)

#### `GET /api/games/top-rated`
- Returns games ordered by score descending
- **Query params**: `limit` (default: 8)

#### `GET /api/games/[slug]`
- Returns a single game by slug with all fields
- Returns 404 if not found

#### `GET /api/games/[slug]/reviews`
- Returns paginated reviews for a specific game
- **Query params**: `sort` (`newest` | `helpful`), `page`
- Joins with `profiles` and `games` tables for user/game metadata
- Page size: 12

#### `GET /api/games/[slug]/deals`
- Returns current price deals from CheapShark
- Tries `cheapshark_id` first, falls back to `steam_app_id`
- Returns: `{ title, priceCurrent, priceLowest, priceCurrency, isFree, deals[] }`
- Each deal has: store name, price, retail price, savings %, deal URL

#### `GET /api/games/[slug]/news`
- Returns latest Steam news/patch notes
- Requires game to have a `steam_app_id`
- **Query params**: `count` (default: 5, max: 20)
- Returns: `{ title, steamAppId, news[] }` where each article has id, title, url, author, contents, feedLabel, date, tags

#### `GET /api/games/[slug]/achievements`
- Returns Steam achievement stats (names, icons, global unlock %)
- Requires game to have a `steam_app_id` and `STEAM_API_KEY` for schema
- **Query params**: `limit` (default: 20, max: 100)
- Returns: `{ title, steamAppId, total, achievements[] }` sorted by unlock % descending

### 8.2 Search Route

#### `GET /api/search`
- Full-text search across games with multi-filter support
- **Query params**:
  - `q` — Text query (searches title, developer, publisher, description via `ilike`)
  - `platform` — `PC` | `Android` | `All`
  - `genre` — Genre name filter (uses array `contains`)
  - `year` — Release year filter (date range)
  - `monetization` — `Free` | `Paid` | `Free with IAP` | etc. | `All`
  - `sort` — `relevance` | `newest` | `top-rated` | `trending`
  - `page` — Page number
- **On-demand ingestion**: If text query returns 0 results and no filters are active, automatically attempts to ingest the game from external sources and re-queries
- Page size: 12

### 8.3 Review Routes

#### `GET /api/reviews`
- Returns the global reviews feed across all games
- **Query params**: `sort` (`newest` | `helpful`), `platform` (`PC` | `Android` | `All`), `page`
- Joins with `games` and `profiles` tables
- Page size: 12

### 8.4 List Routes

#### `GET /api/lists`
- Returns all curated lists with their games
- For each list: fetches `list_items` → resolves `game_id` → maps to full Game objects
- Games are ordered by `position` within each list

#### `GET /api/lists/[slug]`
- Returns a single list by slug with ordered games
- Returns 404 if not found

### 8.5 Profile Route

#### `GET /api/profile/[username]`
- Returns a user profile by username with stats
- Counts reviews by `profile_id` and lists by `curated_by` username
- Returns 404 if not found

### 8.6 Ingestion Routes

#### `POST /api/ingest/game`
- On-demand single game ingestion
- **Auth**: Optional `CRON_SECRET` check (query param or Bearer token)
- **Body**: `{ "query": "Hades", "forceRefresh": false }`
- Validates: Supabase + RAWG configured, query length 2–200 chars
- Calls `ingestGame()` service
- Returns: `{ success, gameId, slug, message, alreadyExisted }`

#### `POST /api/ingest/batch`
- Batch game ingestion (sequential with rate limiting)
- **Auth**: Optional `CRON_SECRET` check
- **Body**: `{ "queries": ["Hades", "Elden Ring", "Stardew Valley"] }`
- Maximum 50 games per batch
- Returns: `{ total, succeeded, failed, alreadyExisted, results[] }`

### 8.7 Cron Routes

#### `GET /api/cron/discover`
- Auto-discovers new games from RAWG across 5 categories:
  1. **Trending** — recently added, last 90 days (20 games)
  2. **New releases** — released in last 30 days (15 games)
  3. **Upcoming** — next 90 days (10 games)
  4. **Top rated this year** — Metacritic ≥ 70 (15 games)
  5. **Popular all-time** — Metacritic ≥ 80 (15 games)
- Deduplicates by RAWG slug
- Ingests each game (existing ones auto-skipped)
- 200ms delay between ingestion calls
- **Auth**: Optional `CRON_SECRET` check
- Returns: `{ discovered, newGamesIngested, alreadyExisted, failed, newGames[], errors[], timestamp }`

#### `GET /api/cron/refresh-trending`
- Updates `trending` and `featured` flags using multi-source signals
- **Flow**:
  1. Fetch IGDB PopScore (weighted: visits 25%, want-to-play 30%, playing 30%, Steam peak 15%)
  2. Cross-reference with database by slug/title matching
  3. RAWG fallback: fetch trending from last 90 days
  4. Fill remaining slots with recency-weighted high-scored games (combined recency bonus + score * 0.25)
  5. Reset all `trending`/`featured` flags to `false`
  6. Set `trending = true` for up to 20 games
  7. Set `featured = true` for top 5 trending by score
- **Auth**: Optional `CRON_SECRET` check
- Returns: `{ trendingCount, featuredCount, log[], timestamp }`

---

## 9. Ingestion Pipeline

**File**: `src/lib/services/ingest.ts`

The ingestion pipeline is the core data enrichment engine. It follows a 13-step process:

### Step-by-Step Flow

1. **Search RAWG** — Find the best match for the query, scoring by: has release date (+3), has rating (+2), higher ratings_count (up to +5)
2. **Generate slug** — `slugify(bestMatch.name)`
3. **Check for duplicates** — Query by `slug` or `rawg_id`; return early if exists (unless `forceRefresh`)
4. **Fetch full details** — In parallel: RAWG game details + screenshots + store links
5. **Extract store IDs** — Parse Steam App ID and Play Store URL from store links
6. **Multi-source enrichment** — Fire all enrichment calls in parallel:
   - Steam review summary (if Steam game)
   - Steam app details for pricing
   - Steam concurrent player count
   - CheapShark deal search
   - IGDB metadata match (if Twitch credentials configured)
   - Wikipedia game summary
7. **Process Steam data** — Extract review percentage, count, price, player count
8. **Process CheapShark data** — Compare prices (use lower of Steam/CheapShark), get cheapest-ever, deal URL
9. **Process IGDB data** — Extract trailer URL, Wikipedia/Reddit/official URLs, IGDB rating
10. **Process Wikipedia data** — Get excerpt and page URL
11. **Compute score** — Priority chain: Steam review % → IGDB aggregated → RAWG Metacritic → RAWG rating × 20. Also computes `verdict_label` via `scoreToVerdict()`
12. **Build game record** — 50+ field object including:
    - Auto-generated `verdict_summary` based on score + genres
    - Auto-generated `pros` from: Steam sentiment, player count, IGDB rating, genre tags (story rich, open world, multiplayer, great soundtrack, indie)
    - Auto-generated `cons` from: Steam reception, difficulty tags, early access, microtransactions, grind tags
    - Best `description` from Wikipedia → IGDB summary → IGDB storyline → RAWG (sentence-trimmed at 1200 chars)
    - `monetization` detection via free-to-play tags
13. **Upsert + source mappings** — Insert or update game record; create/upsert source entries for RAWG, Steam, IGDB, CheapShark in `game_sources` table

### Batch Ingestion
- Processes queries sequentially with 1 second delay between each
- Returns individual results for each game

---

## 10. Frontend — Pages

### 10.1 Home Page
**File**: `src/app/page.tsx` (Client Component)

Sections displayed in order:
1. **Hero Carousel** — Auto-advancing (7s interval) carousel of featured/trending games with swipe support, gradient overlays, score rings, verdict badges, score chips, CTA button
2. **Most Played Right Now** — Spotlight card (3/4 aspect ratio) for #1 trending game + 2–4 column grid for remaining trending games, ordered by concurrent players
3. **New Releases** — 4-column GameGrid of newest releases
4. **Top Verdict Scores** — 4-column GameGrid of highest-scored games
5. **Recommended For You** — Horizontal scroll of genre-diverse picks (filters out trending duplicates)
6. **Footer** — Links to About, Privacy, Terms + data attribution

**Data fetching**: React Query with 5-minute stale times. Shows skeleton states (`HeroSkeleton`, `GameGridSkeleton`, `SectionHeaderSkeleton`) while loading.

### 10.2 Game Detail Page
**File**: `src/app/game/[slug]/page.tsx` (Client Component)

The most feature-rich page in the application:

**Hero section**: Full-bleed header image (50–60vh) with gradient overlays (always dark), platform badges, free-to-play indicator, release date, title, developer/genre chips.

**Main content (two-column layout)**:

**Left column (8/12)**:
- **Verdict Card** — Score ring with glow effect, verdict badge, summary, 3-column score breakdown (Verdict/Steam/IGDB), multi-source score chips with source attribution, pros/cons in two-column layout
- **Overview** — Best description from Wiki/IGDB/RAWG, tags cloud
- **Media** — Trailer (YouTube link with thumbnail overlay, play button) + screenshot carousel with thumbnails
- **Performance & Monetization** — Two-column cards with details and fallback text
- **Steam Achievements** — List of achievements with icons, names, descriptions, and global unlock % with color-coded stat bars
- **Latest News** — Steam news/patch notes with author, date, feed label
- **Community Reviews** — Steam review summary card (percentage bar, positive/negative breakdown, link to Steam reviews) + verdict.games user reviews or "Be the first" CTA

**Right column (4/12, sticky)**:
- **Where to Play** — Links to Steam, Google Play, Best Deal (CheapShark), Official Site; current price + all-time low
- **Details** — Developer, publisher, release date, genres, monetization
- **Live Stats** — Animated stat bars for Verdict score, Community score, Critic score; live player count with "updated X ago" timestamp; Steam review count
- **External Links** — Grid of links to IGDB, Wikipedia, Metacritic, Reddit

**Full-width sections**:
- **Related Games** — 4-column grid of same-genre games
- **Attribution** — Data source list + enrichment sources

**SEO**: Layout file generates dynamic metadata (title, description, OpenGraph, Twitter Card) from Supabase data.

### 10.3 Search Page
**File**: `src/app/search/page.tsx` (Client Component)

- **Search bar** — Pre-filled from URL query param `q`
- **Filters**: Platform (All/PC/Android), Genre (auto-detected from data), Year (last 15 years), Monetization (All/Free/Paid/etc.), Sort (Relevance/Newest/Top Rated/Trending)
- **Results**: GameGrid with pagination (Previous/Next buttons)
- **Empty states**: "No games found" with reset button, or "Try searching..." prompt
- Uses URL search params as source of truth; syncs with React state

### 10.4 Reviews Page
**File**: `src/app/reviews/page.tsx` (Client Component)

- **Filters**: Sort (Newest/Most Helpful), Platform (All/PC/Android)
- **Feed**: Paginated ReviewCard list showing game cover, user info, rating, title, body, pros/cons, helpful count
- **Pagination**: Page number display + Previous/Next

### 10.5 Lists Page
**File**: `src/app/lists/page.tsx` + `src/app/lists/[slug]/page.tsx` (Client Components)

**Index page**: Grid of curated list cards showing cover image, title, description, game count, tags
**Detail page**: Full list display with header (title, description, curator, tags) + GameGrid of all games in the list, followed by game count stats

### 10.6 Profile Page
**File**: `src/app/profile/[username]/page.tsx` (Client Component)

- **Header**: Avatar (128×128), display name, username, join date, bio
- **Stats**: Games Reviewed, Lists Created, Favorite Genres badges
- **Activity**: Tabbed interface (Reviews / Lists) with user's reviews as ReviewCards

### 10.7 Static Pages

#### About (`src/app/about/page.tsx`)
- Mission statement, features list, data attribution table (RAWG, Steam, IGDB, CheapShark, Wikipedia with descriptions), tech stack list, "built by verdictgamer" credit

#### Privacy (`src/app/privacy/page.tsx`)
- Privacy policy covering: Information collected, how it's used, cookies, data security, third-party services, user rights, children's privacy, contact info

#### Terms (`src/app/terms/page.tsx`)
- Terms of service covering: Use of service, intellectual property, user content, data accuracy, no warranties, limitation of liability, changes, contact info

---

## 11. Frontend — Components

### 11.1 Layout Components

#### `NavbarTop`
- **Mobile**: Sticky header with logo, search toggle (animated dropdown), theme toggle. Height: 48px
- **Desktop**: Sticky header with logo, nav links (Home, Reviews, Lists, About) with active underline animation (`layoutId`), search input with icon, theme toggle. Height: 56px
- **Search**: Form submission navigates to `/search?q=...`

#### `BottomNav`
- **Mobile only** (`md:hidden`): Fixed bottom navigation bar with 5 icons (Home, Search, Reviews, Lists, Profile)
- Active state: accent color + scale animation + top indicator dot
- Height: 56px with safe area bottom padding

#### `SectionHeader`
- Section title with accent bar, optional emoji icon, subtitle, optional "See all →" link

#### `FadeInSection`
- Framer Motion wrapper for scroll-reveal animation
- Supports directional entrance (up, left, right, none) with custom delay
- `viewport: { once: true, margin: "-60px" }` — triggers when 60px into viewport

### 11.2 Display Components

#### `GameCard`
Two variants:
- **Default**: Aspect 5:7 cover image, score overlay (top-right), platform badges (bottom-left), year badge (top-left), title, verdict badge, score chips, genres. Hover: lift + scale + shimmer effect, pixel corner decorations
- **Spotlight**: Aspect 3:4 cover image, larger content overlay at bottom with platforms, year, title, verdict badge, score chips, verdictSummary. Used for trending section #1

#### `GameGrid`
- Responsive grid (2/3/4 columns) with Framer Motion staggered entrance animation (0.06s delay between items)
- Empty state: "No games found" message

#### `HeroCarousel`
- Auto-advancing carousel (configurable interval, default 7s)
- Touch/swipe support via Framer Motion drag (50px threshold)
- Pause on hover
- Navigation arrows (desktop only, hidden on hover until visible)
- Dot indicators (expandable active dot)
- Slide transitions: horizontal enter/exit with scale + opacity
- Content transitions: fade up with 0.2s delay
- Shows: Featured label, title, score ring, verdict badge, platform badges, year, multi-source score chips, summary, "Read Verdict" CTA

#### `FeaturedHero`
- Static (non-carousel) featured game display
- Same visual treatment as carousel slide but without auto-advance

#### `MediaCarousel`
- Image gallery with main viewport + thumbnail strip
- Navigation arrows for main image
- Clickable thumbnails with active ring indicator
- AnimatePresence for smooth transitions

#### `ReviewCard`
- Displays: game cover (optional), game title, username, date, platform, circular score badge, review title, body (4 lines clamp), pros/cons, helpful count
- Pixel corner decorations, hover border/shadow effects

#### `ScoreChips`
Multi-source score display with two variants:
- **Compact** (for cards): Small badges showing Steam %, IGDB rating, Metacritic score
- **Full** (for heroes/detail pages): Larger badges with emoji icons, labels, and detail info (e.g., "Very Positive (245K)")
- Chip styling: Steam = dark blue/cyan, IGDB = purple, Metacritic = yellow
- Fallback: Shows "Verdict {score}" if no source-specific scores exist

#### `HorizontalScroll`
- Scrollable container with gradient edge fades
- Navigation arrows (desktop only, visible on hover)
- Smooth scroll by 60% of container width per click
- Hidden scrollbar (`no-scrollbar` class)

### 11.3 UI Primitives

#### `FilterChips<T>`
- Generic radio-group chip selector
- Active chip: accent background with white text
- Inactive: surface background with secondary text, hover effects

#### `PixelBadge`
- Inline label badge with 6 color variants: `default`, `accent`, `success`, `warning`, `danger`, `muted`
- 2 sizes: `sm` (10px text), `md` (12px text)
- Uppercase tracking-wider styling

#### `PixelButton`
- Button component with 4 variants: `primary` (accent fill), `secondary` (outline), `ghost` (transparent), `danger` (red tint)
- 3 sizes: `sm`, `md`, `lg`
- Framer Motion hover (scale 1.02) and tap (scale 0.98)
- Focus-visible outline for accessibility

#### `PixelCard`
- Generic card container with pixel corner decorations
- Optional hover lift effect
- Corner color options: accent, green, cyan, orange

#### `ScoreRing`
- SVG circular progress ring with animated fill
- Configurable size, stroke width
- Color derived from score via `scoreColorVar()`
- Animation: stroke offset animates from 0 to score% on mount (1s ease-out, 0.2s delay)
- Center: numeric score label

#### `Skeleton`
- Base shimmer animation using gradient background
- Pre-built variants: `GameCardSkeleton`, `ReviewCardSkeleton`, `HeroSkeleton`, `SectionHeaderSkeleton`, `GameGridSkeleton`

#### `SortDropdown<T>`
- Styled `<select>` dropdown with custom arrow SVG
- Accepts generic option types with label/value pairs

#### `Tabs`
- Tab navigation with animated underline indicator (`layoutId`)
- Content fade-in on tab switch
- Overflow-x scrollable tab bar for mobile

#### `VerdictBadge`
- Colored label for verdict labels (`MUST PLAY`, `WORTH IT`, `MIXED`, `SKIP`)
- Colors mapped via `verdictBgClass()`:
  - MUST PLAY: green
  - WORTH IT: lime
  - MIXED: yellow
  - SKIP: red
- 3 sizes: `sm`, `md`, `lg`

---

## 12. Design System

**File**: `src/app/globals.css` (643 lines)

### 12.1 Color Tokens

All colors defined as CSS custom properties under `:root` (dark) and `.light` class:

**Dark Mode** (default):
| Token | Value | Purpose |
|-------|-------|---------|
| `--vg-bg` | `#060a13` | Page background |
| `--vg-surface` | `#0c1220` | Card/container background |
| `--vg-surface-2` | `#131c2e` | Elevated surface |
| `--vg-elevated` | `#1a2540` | Higher elevation |
| `--vg-border` | `#1e2a42` | Default border |
| `--vg-border-hover` | `#2d3d5c` | Hover border |
| `--vg-accent` | `#a855f7` | Purple accent |
| `--vg-accent-hover` | `#c084fc` | Accent hover |
| `--vg-accent-soft` | `rgba(168,85,247,0.1)` | Accent tint |
| `--vg-accent-glow` | `rgba(168,85,247,0.3)` | Accent glow |
| `--vg-pixel-green` | `#4ade80` | Green accent |
| `--vg-pixel-cyan` | `#22d3ee` | Cyan accent |
| `--vg-pixel-orange` | `#fb923c` | Orange accent |
| `--vg-success` | `#4ade80` | Success state |
| `--vg-warning` | `#fbbf24` | Warning state |
| `--vg-danger` | `#f87171` | Danger state |
| `--vg-text` | `#f1f5f9` | Primary text |
| `--vg-text-secondary` | `#94a3b8` | Secondary text |
| `--vg-text-muted` | `#64748b` | Muted/tertiary text |
| `--vg-score-great` | `#4ade80` | Score ≥ 90 |
| `--vg-score-good` | `#a3e635` | Score ≥ 75 |
| `--vg-score-mixed` | `#facc15` | Score ≥ 50 |
| `--vg-score-bad` | `#f87171` | Score < 50 |

**Light Mode** overrides the same tokens with appropriate light-theme colors.

**Tailwind v4 mapping** (`@theme inline`): All CSS variables are mapped to Tailwind color names (e.g., `bg-background`, `text-foreground`, `border-border`, `text-accent`).

### 12.2 Typography

- **Sans**: Geist Sans (via `next/font/google`)
- **Mono**: Geist Mono (via `next/font/google`)
- Font smoothing: webkit + moz antialiasing
- Selection color: accent text on white background

### 12.3 Animations & Transitions

**CSS Keyframes**:
| Animation | Description |
|-----------|-------------|
| `shimmer` | Background position shift for loading skeletons |
| `pixel-pulse` | Opacity pulsing for indicator dots |
| `fade-in-up` | Translate Y 24px → 0 with opacity |
| `fade-in` | Simple opacity 0 → 1 |
| `slide-in-right` | Translate X 20px → 0 with opacity |
| `scale-in` | Scale 0.95 → 1 with opacity |
| `glow-pulse` | Box-shadow pulsing with accent glow |
| `gradient-shift` | Background-position cycling for gradient borders |
| `stat-fill` | Width from 0% to `var(--fill-width)` |
| `float` | Subtle translateY bounce |
| `page-enter` | Translate Y 8px → 0 with opacity |
| `ripple` | Scale to 4x with opacity fadeout |
| `subtle-bounce` | Small vertical bounce |
| `slide-up-reveal` | Translate Y 32px → 0 with blur 4px → 0 |

**Stagger delay utilities**: `.stagger-1` through `.stagger-8` (50ms increments)

**Reduced motion**: All animations and transitions reduced to 0.01ms when `prefers-reduced-motion: reduce`

### 12.4 Visual Effects

| Effect Class | Description |
|-------------|-------------|
| `.pixel-corners` | 8×8 pixel corner decorations with accent-colored L-shaped borders |
| `.pixel-corners-green` | Green corner variant |
| `.pixel-corners-cyan` | Cyan corner variant |
| `.pixel-divider` | Dotted horizontal divider with accent repeating gradient |
| `.scanlines` | Subtle scanline overlay (repeating 2px transparent/opaque) |
| `.glass-card` | Frosted glass card (blur 12px, semi-transparent background) |
| `.glass-panel` | Deeper frosted glass (blur 20px, saturation 1.2) |
| `.hover-lift` | Translate Y -4px + shadow on hover |
| `.press-effect` | Scale 0.97 on active/press |
| `.gradient-text` | Purple-to-cyan gradient text fill |
| `.gradient-border` | Animated gradient border (gradient-shift animation, 4s cycle) |
| `.score-glow-*` | Score-colored box-shadow glows (great/good/mixed/bad) |
| `.mesh-gradient` | Multi-radial gradient background for sections |
| `.hero-spotlight` | Radial gradient spotlight effect for hero sections |
| `.noise-texture` | SVG fractal noise texture overlay at 3% opacity |
| `.section-title-line` | Accent underline decoration for section headers |
| `.card-shimmer` | Hover shimmer sweep effect (translateX -100% → 100%) |
| `.animate-float` | Subtle floating animation (3s infinite) |
| `.text-shimmer` | Gradient text with shimmer animation |
| `.hero-gradient-bottom` | Dark gradient from bottom (always dark, not theme-dependent) |
| `.hero-gradient-right` | Dark gradient from right |
| `.hero-gradient-vignette` | Accent-colored vignette corners |
| `.hero-overlay-text` | Forces light text on hero overlays (both themes) |
| `.card-image-gradient` | Dark gradient for card images (always dark) |
| `.steam-review-bar` | Gradient bar showing positive/negative review split |
| `.stat-bar-fill` | Animated width bar for statistics |

**Custom scrollbar**: 6px width, track matches background, thumb matches border with hover effect.

**Safe area**: `.safe-area-bottom` with `env(safe-area-inset-bottom)` for notched devices.

---

## 13. State Management & Data Fetching

### React Query Setup
**File**: `src/app/providers.tsx`

- `QueryClient` created per-session with `useState` (prevents SSR hydration issues)
- Default options: `staleTime: 60_000` (1 minute), `refetchOnWindowFocus: false`
- Per-query overrides: trending/featured sections use `staleTime: 5 * 60 * 1000` (5 minutes)

### Data Flow
```
User visits page
    → React Query checks cache
    → If stale/missing: fetch /api/... route
    → API route queries Supabase
    → Maps DB rows to frontend types
    → Returns JSON response
    → React Query caches result
    → Components render data
```

### Query Keys
| Key Pattern | Page/Component |
|------------|----------------|
| `["featured"]` | Home — hero carousel |
| `["trending"]` | Home — trending section |
| `["newReleases"]` | Home — new releases |
| `["topRated"]` | Home — top rated |
| `["personalized"]` | Home — recommended |
| `["game", slug]` | Game detail |
| `["gameReviews", slug]` | Game detail — reviews tab |
| `["relatedGames", slug]` | Game detail — related games |
| `["gameNews", slug]` | Game detail — Steam news |
| `["gameAchievements", slug]` | Game detail — achievements |
| `["search", filters]` | Search page |
| `["globalReviews", options]` | Reviews page |
| `["curatedLists"]` | Lists page |
| `["list", slug]` | List detail |
| `["profile", username]` | Profile page |

---

## 14. Theming (Dark / Light Mode)

**File**: `src/hooks/useTheme.tsx`

- **React Context** providing `{ theme, toggle }` to all components
- **Dark mode is default** (`:root` in CSS)
- Light mode activates by adding `.light` class to `<html>`
- **Persistence**: `localStorage.getItem("vg-theme")` / `localStorage.setItem("vg-theme", ...)`
- **Toggle component**: `ThemeToggle.tsx` — 9×9 button with animated icon swap (☀ / ◐)
- **HTML attribute**: `suppressHydrationWarning` on `<html>` to prevent SSR mismatch
- **Hero sections always render with dark gradients** regardless of theme (`.hero-gradient-*`, `.hero-overlay-text` classes force dark appearance so images stay vibrant)

---

## 15. Client-Side API Layer

**File**: `src/lib/api.ts`

A typed fetch wrapper layer that all client components use to call the internal API routes:

**Core helper**:
- `getBaseUrl()` — Returns empty string on client (relative URLs), full URL on server
- `apiFetch<T>(path, options)` — Fetch wrapper that: sets `Content-Type: application/json`, checks `res.ok`, parses JSON, extracts `json.data` if `json.success`, returns `null` on failure

**Game functions**:
| Function | Route Called | Notes |
|----------|-------------|-------|
| `getFeaturedGame()` | `/api/games/trending` | Returns first featured or first trending |
| `getFeaturedGames(limit)` | `/api/games/trending` | Featured first, then fill with trending |
| `getTrendingGames()` | `/api/games/trending?limit=10` | |
| `getNewReleases(limit)` | `/api/games/new-releases?limit=X` | |
| `getTopRated(limit)` | `/api/games/top-rated?limit=X` | |
| `searchGames(filters)` | `/api/search?q=&platform=&genre=&year=&monetization=&sort=&page=` | Returns PaginatedResponse |
| `getGameBySlug(slug)` | `/api/games/{slug}` | |
| `getRelatedGames(slug, limit)` | Composes `getGameBySlug` + `searchGames` | Same genre, excludes self |
| `getPersonalizedGames(limit)` | Composes `getTopRated` + `getTrendingGames` | Genre-diverse picks excluding trending |

**Review functions**:
| Function | Route Called |
|----------|-------------|
| `getGameReviews(slug, options)` | `/api/games/{slug}/reviews?sort=&page=` |
| `getGlobalReviews(options)` | `/api/reviews?sort=&platform=&page=` |

**Steam data functions**:
| Function | Route Called |
|----------|-------------|
| `getGameNews(slug, count)` | `/api/games/{slug}/news?count=X` |
| `getGameAchievements(slug, limit)` | `/api/games/{slug}/achievements?limit=X` |

**List functions**:
| Function | Route Called |
|----------|-------------|
| `getCuratedLists()` | `/api/lists` |
| `getListBySlug(slug)` | `/api/lists/{slug}` |

**User functions**:
| Function | Route Called |
|----------|-------------|
| `getUserProfile(username)` | `/api/profile/{username}` |
| `getUserReviews(username)` | Composes `getGlobalReviews` + filter by username |

---

## 16. TypeScript Types

**File**: `src/lib/types.ts`

### Enums / Union Types
```typescript
Platform       = "PC" | "Android"
MonetizationType = "Free" | "Paid" | "Free with IAP" | "Free with Ads" | "Subscription"
VerdictLabel   = "MUST PLAY" | "WORTH IT" | "MIXED" | "SKIP"
SortOption     = "relevance" | "newest" | "top-rated" | "trending"
```

### Core Interfaces

**`Game`** (87 fields) — The central data model covering:
- Identity: id, slug, title, subtitle
- Media: coverImage, headerImage, screenshots, trailerUrl, trailerThumbnail
- Classification: platforms, genres, tags
- Credit: developer, publisher
- Dates: releaseDate
- Content: description
- Verdict: score (0–100), verdictLabel, verdictSummary, pros[], cons[]
- Detail sections: monetization, performanceNotes, monetizationNotes
- Links: steamUrl, playStoreUrl, igdbUrl, wikipediaUrl, metacriticUrl, websiteUrl, redditUrl
- Metadata: reviewCount, userScore, featured, trending
- Pricing: priceCurrent (cents), priceCurrency, priceLowest, priceDealUrl, isFree
- Players: currentPlayers, peakPlayers24h, playersUpdatedAt
- Per-source scores: steamRatingLabel, rawgMetacritic, rawgRating, igdbRating, scoreSource
- Enrichment: lastEnrichedAt, enrichmentSources[]

**`Review`** — userId, gameId, gameSlug, gameTitle, gameCover, username, userAvatar, rating (0–100), title, body, pros[], cons[], helpful, createdAt, platform

**`User`** — id, username, displayName, avatar, bio, gamesReviewed, listsCreated, joinedAt, favoriteGenres[], recentActivity[]

**`ActivityItem`** — id, type (review/list/rating), gameSlug, gameTitle, listSlug, listTitle, rating, createdAt

**`GameList`** — id, slug, title, description, coverImage, gameCount, games[], curatedBy, createdAt, tags[]

**`SearchFilters`** — query, platform, genre, year, monetization, sort, page

**`PaginatedResponse<T>`** — items[], total, page, pageSize, hasMore

### Database Types
**File**: `src/lib/supabase/types.ts`

Full `Database` interface with typed `Tables` for all 6 tables (Row, Insert, Update generics). Convenience aliases: `GameRow`, `GameInsert`, `ReviewRow`, `ListRow`, `ListItemRow`, `ProfileRow`, `GameSourceRow`.

---

## 17. Utility Functions

### `src/lib/utils.ts` (Frontend)

| Function | Signature | Purpose |
|----------|-----------|---------|
| `scoreToVerdict` | `(score: number) → VerdictLabel` | Score → verdict: ≥90 "MUST PLAY", ≥75 "WORTH IT", ≥50 "MIXED", else "SKIP" |
| `scoreColor` | `(score: number) → string` | Score → Tailwind text-color class |
| `scoreColorVar` | `(score: number) → string` | Score → CSS variable string for SVG strokes |
| `verdictBgClass` | `(label: VerdictLabel) → string` | Verdict → bg/text/border class string |
| `formatDate` | `(dateStr: string) → string` | ISO/YYYY-MM-DD → "Mar 15, 2025" (returns "TBA" for invalid) |
| `truncate` | `(text: string, maxLength: number) → string` | Truncate with "…" |
| `pluralize` | `(count, singular, plural?) → string` | Simple pluralize |
| `cn` | `(...classes) → string` | Class name merge (filters falsy values) |

### `src/lib/utils/score.ts` (Server-safe)
| Function | Purpose |
|----------|---------|
| `scoreToVerdict` | Same as above, but without Tailwind dependencies (safe for server code) |

### `src/lib/utils/slugify.ts`
| Function | Purpose |
|----------|---------|
| `slugify` | Title → URL slug (lowercase, hyphens, strip specials, `&` → `and`) |

### `src/lib/api/response.ts`
| Function | Purpose |
|----------|---------|
| `jsonOk(data, status?)` | `{ success: true, data }` with status (default 200) |
| `jsonError(message, status?)` | `{ success: false, error }` with status (default 500) |
| `jsonNotFound(entity?)` | 404 error response |
| `jsonBadRequest(message?)` | 400 error response |

### `src/lib/db/mappers.ts`
| Function | Purpose |
|----------|---------|
| `mapGameRow(row)` | `GameRow` → `Game` (snake_case → camelCase, 50+ fields) |
| `mapReviewRow(row)` | `ReviewRow` (with joins) → `Review` |
| `mapProfileRow(row, stats)` | `ProfileRow` → `User` with review/list counts |
| `mapListRow(row, games)` | `ListRow` + `Game[]` → `GameList` |

---

## 18. Scripts

All scripts are ESM (`.mjs`) files using `dotenv` for environment variable loading and `postgres` for direct database connections.

### `scripts/ingest-full-library.mjs`
- Ingests a curated list of ~300 games across multiple categories:
  - Top PC games, indie gems, FPS, RPG, simulation, horror, fighting, racing, puzzle, sports, MMO, retro, strategy, sandbox, narrative, roguelike, VR-compatible, cozy/relaxing, mobile crossplay, free-to-play, recent releases
- Calls `POST /api/ingest/batch` with chunks of ~20 games
- Sequential processing with rate limiting

### `scripts/seed-flags.mjs`
- Sets `trending` and `featured` flags in the database
- Marks top 20 games by score as trending
- Marks top 5 as featured
- Uses direct SQL via `postgres` library

### `scripts/refresh-games.mjs`
- Re-ingests specific games by calling `/api/ingest/game` with `forceRefresh: true`
- Used to update stale game data

### `scripts/refresh-all-games.mjs`
- Fetches all game slugs from database
- Re-ingests each one with `forceRefresh: true`
- 1.5-second delay between requests

### `scripts/heroku-discover-games.mjs`
- Calls `GET /api/cron/discover` with `CRON_SECRET`
- For Heroku Scheduler automation

### `scripts/heroku-refresh-trending.mjs`
- Calls `GET /api/cron/refresh-trending` with `CRON_SECRET`
- For Heroku Scheduler automation

### `scripts/apply-schema.mjs`
- Applies `supabase/schema.sql` to database via direct PostgreSQL connection

### `scripts/apply-migration-001.mjs`
- Applies `supabase/migrations/001_multi_source.sql`

### `scripts/migrate-score-columns.mjs`
- Adds per-source score columns (`steam_rating_label`, `rawg_metacritic`, `rawg_rating`, `score_source`) and re-enriches all games

### `scripts/migrate-players-updated-at.mjs`
- Adds `players_updated_at` column to games table

---

## 19. SEO & Metadata

### Root Layout Metadata (`src/app/layout.tsx`)
```
metadataBase: https://www.verdict.games
title.default: "verdict.games — The Verdict on Every Game"
title.template: "%s | verdict.games"
description: Game reviews platform description
icons: /favicon.png
openGraph: type=website, 1200×630 OG image
twitter: summary_large_image card
```

### Dynamic Game Page Metadata (`src/app/game/[slug]/layout.tsx`)
- Fetches game data from Supabase at build/request time
- Generates: title with score, description from verdict summary, keywords array, canonical URL
- OpenGraph: article type, cover image, 400×560 dimensions
- Twitter: summary_large_image card

### Robots.txt (`src/app/robots.ts`)
- Allow: `/` (all paths)
- Disallow: `/api/`, `/profile/` (prevent API routes and profile pages from indexing)
- Sitemap: `{SITE_URL}/sitemap.xml`

### Dynamic Sitemap (`src/app/sitemap.ts`)
- **Static pages**: Home (daily, priority 1.0), Search (daily, 0.8), Lists (weekly, 0.7), Reviews (weekly, 0.7), About (monthly, 0.4), Privacy (yearly, 0.2), Terms (yearly, 0.2)
- **Dynamic game pages**: Up to 1000 games from Supabase, sorted by score, weekly change frequency, 0.9 priority
- Falls back to static pages only if Supabase is not configured

### Per-Page Layouts
- Search, Reviews, Lists pages have layout files providing static metadata (title, description)

---

## 20. Deployment

### Vercel (Primary)
1. Push to GitHub
2. Import into Vercel
3. Add environment variables in Vercel → Settings → Environment Variables
4. Set `NEXT_PUBLIC_SITE_URL` to production URL
5. Deploy — `vercel.json` hints `nextjs` framework

### Heroku (Alternative)
- `Procfile`: `web: npm run start`
- `heroku-postbuild` script: `next build`
- Scheduler commands:
  - `npm run scheduler:trending` — daily trending refresh
  - `npm run scheduler:discover` — periodic game discovery

### Cron Job Setup
- **Discover**: Run `GET /api/cron/discover?secret=YOUR_SECRET` daily or weekly
- **Refresh Trending**: Run `GET /api/cron/refresh-trending?secret=YOUR_SECRET` daily
- Can be triggered via: Vercel Cron, Heroku Scheduler, GitHub Actions, or any external cron service

---

## 21. Security

### API Key Protection
- `SUPABASE_SERVICE_ROLE_KEY` — **Server-only**, imported only in `src/lib/supabase/server.ts`, which is only used by Route Handlers. Never exposed to client
- `RAWG_API_KEY`, `STEAM_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` — Server-only, used in `src/lib/external/*.ts` files
- All POST ingestion routes support optional `CRON_SECRET` authentication (query param or Bearer header)

### Database Security
- Row Level Security (RLS) enabled on all 6 tables
- Public `SELECT` policies allow read-only access
- All write operations (`INSERT`, `UPDATE`, `DELETE`) restricted to `service_role` — only accessible via server-side code using the service role key
- The `anon` key (public) cannot write to any table

### Input Validation
- Ingestion routes validate: JSON body parsing, query string length (2–200 chars), batch size (max 50)
- Bad requests return 400 with descriptive messages
- POST routes check for required fields before processing

### Environment Checks
- All API routes check for Supabase configuration before attempting database operations
- Missing config returns empty data (graceful degradation), not crashes

---

## 22. Scoring Algorithm

The Verdict Score is a **0–100 integer** derived from the best available source during ingestion:

### Score Priority Chain
1. **Steam Review %** (preferred) — `(total_positive / total_reviews) * 100`
2. **IGDB Aggregated Rating** — external critic average (0–100)
3. **RAWG Metacritic Score** — Metacritic score from RAWG (0–100)
4. **RAWG User Rating × 20** — RAWG rating (0–5) scaled to 0–100

The `score_source` column tracks which source was used.

### Verdict Labels
| Score Range | Verdict Label |
|-------------|---------------|
| 90–100 | `MUST PLAY` |
| 75–89 | `WORTH IT` |
| 50–74 | `MIXED` |
| 0–49 | `SKIP` |

### Score Color Mapping
| Score Range | Color | CSS Variable |
|-------------|-------|-------------|
| ≥ 90 | Green | `--vg-score-great` |
| ≥ 75 | Lime | `--vg-score-good` |
| ≥ 50 | Yellow | `--vg-score-mixed` |
| < 50 | Red | `--vg-score-bad` |

### Verdict Summary Generation
Auto-generated based on score + primary genre:
- ≥ 90: `"{title} is an exceptional {genre} experience that sets a new standard."`
- ≥ 75: `"{title} is a solid {genre} worth your time and attention."`
- ≥ 50: `"{title} has moments of brilliance but inconsistent execution holds it back."`
- < 50: `"{title} struggles to deliver on its {genre} promises."`

### Pros/Cons Generation
**Pros** are auto-generated from:
- Steam review sentiment (if ≥ 90% → "Overwhelmingly Positive on Steam (95% positive from 245K reviews)")
- Active playerbase (> 5000 → "Active community with X concurrent players")
- IGDB critic rating (≥ 80 → "Critically acclaimed (X/100 critic average)")
- Genre tags: story rich, open world, multiplayer, great soundtrack, indie gem

**Cons** are auto-generated from:
- Steam reception (< 70% → "Mixed Steam reception (X% positive)")
- Difficulty tags: difficult, souls-like
- Early access tag
- Microtransactions tag
- Grinding/grindy tags
- Below-average rating + high volume
- Fallback: "Limited professional critic coverage" or "No significant drawbacks reported"

### Trending Algorithm (refresh-trending cron)
1. **IGDB PopScore** (weighted composite):
   - IGDB visits: 25%
   - Want-to-play: 30%
   - Currently playing: 30%
   - Steam 24hr peak players: 15%
2. **RAWG trending** (last 90 days, ordered by recently added)
3. **Recency fill** — games from last 4 years weighted by: `score × 0.25 + recencyBonus` where recency bonus is 40 (< 6 months), 30 (< 1 year), 20 (< 2 years), or 10

Featured = top 5 trending by score.

---

## 23. Complete File Reference

| File | Lines | Type | Description |
|------|-------|------|-------------|
| `package.json` | 44 | Config | Dependencies, scripts, engines |
| `next.config.ts` | 21 | Config | Image domains whitelist |
| `tsconfig.json` | 36 | Config | TypeScript strict mode, paths |
| `eslint.config.mjs` | 19 | Config | ESLint 9 flat config |
| `postcss.config.mjs` | 8 | Config | Tailwind CSS v4 plugin |
| `vercel.json` | 3 | Config | Framework hint |
| `Procfile` | 1 | Config | Heroku web process |
| `supabase/schema.sql` | ~210 | SQL | Full database schema |
| `supabase/migrations/001_multi_source.sql` | ~48 | SQL | Multi-source columns |
| `supabase/migrations/002_security_lint_fixes.sql` | ~72 | SQL | Security policy fixes |
| `src/app/layout.tsx` | 72 | Layout | Root layout with fonts, nav, analytics |
| `src/app/page.tsx` | ~220 | Page | Homepage with 5 sections |
| `src/app/providers.tsx` | 26 | Provider | QueryClient + ThemeProvider |
| `src/app/error.tsx` | 27 | Page | Global error boundary |
| `src/app/loading.tsx` | 22 | Page | Root loading skeleton |
| `src/app/globals.css` | 643 | CSS | Full design system |
| `src/app/robots.ts` | 17 | SEO | robots.txt generator |
| `src/app/sitemap.ts` | 50 | SEO | Dynamic sitemap generator |
| `src/app/game/[slug]/page.tsx` | ~650 | Page | Game detail (richest page) |
| `src/app/game/[slug]/layout.tsx` | ~65 | Layout | Game SEO metadata |
| `src/app/game/[slug]/loading.tsx` | ~15 | Page | Game loading skeleton |
| `src/app/search/page.tsx` | ~200 | Page | Search with filters |
| `src/app/reviews/page.tsx` | ~100 | Page | Global reviews feed |
| `src/app/lists/page.tsx` | ~80 | Page | Curated lists index |
| `src/app/lists/[slug]/page.tsx` | ~80 | Page | List detail |
| `src/app/profile/[username]/page.tsx` | ~150 | Page | User profile |
| `src/app/about/page.tsx` | ~120 | Page | About page |
| `src/app/privacy/page.tsx` | ~100 | Page | Privacy policy |
| `src/app/terms/page.tsx` | ~100 | Page | Terms of service |
| `src/app/api/games/trending/route.ts` | ~60 | API | Trending games endpoint |
| `src/app/api/games/new-releases/route.ts` | ~70 | API | New releases endpoint |
| `src/app/api/games/top-rated/route.ts` | ~45 | API | Top rated endpoint |
| `src/app/api/games/[slug]/route.ts` | ~45 | API | Single game endpoint |
| `src/app/api/games/[slug]/reviews/route.ts` | ~90 | API | Game reviews endpoint |
| `src/app/api/games/[slug]/deals/route.ts` | ~80 | API | Game deals endpoint |
| `src/app/api/games/[slug]/news/route.ts` | ~65 | API | Game news endpoint |
| `src/app/api/games/[slug]/achievements/route.ts` | ~65 | API | Game achievements endpoint |
| `src/app/api/search/route.ts` | ~130 | API | Search with on-demand ingest |
| `src/app/api/reviews/route.ts` | ~80 | API | Global reviews feed |
| `src/app/api/lists/route.ts` | ~70 | API | All curated lists |
| `src/app/api/lists/[slug]/route.ts` | ~65 | API | Single list |
| `src/app/api/profile/[username]/route.ts` | ~60 | API | User profile |
| `src/app/api/ingest/game/route.ts` | ~75 | API | Single game ingestion |
| `src/app/api/ingest/batch/route.ts` | ~75 | API | Batch game ingestion |
| `src/app/api/cron/discover/route.ts` | ~150 | API | Auto-discover games |
| `src/app/api/cron/refresh-trending/route.ts` | ~213 | API | Refresh trending/featured |
| `src/components/NavbarTop.tsx` | ~175 | Component | Top navigation |
| `src/components/BottomNav.tsx` | ~100 | Component | Mobile bottom nav |
| `src/components/GameCard.tsx` | ~220 | Component | Game card (2 variants) |
| `src/components/GameGrid.tsx` | ~60 | Component | Animated game grid |
| `src/components/HeroCarousel.tsx` | ~280 | Component | Auto-advancing hero |
| `src/components/FeaturedHero.tsx` | ~109 | Component | Static featured hero |
| `src/components/FadeInSection.tsx` | ~40 | Component | Scroll-reveal wrapper |
| `src/components/HorizontalScroll.tsx` | ~60 | Component | Horizontal scroll container |
| `src/components/MediaCarousel.tsx` | ~110 | Component | Image gallery |
| `src/components/ReviewCard.tsx` | ~125 | Component | Review display card |
| `src/components/ScoreChips.tsx` | ~100 | Component | Multi-source score badges |
| `src/components/SectionHeader.tsx` | ~45 | Component | Section title |
| `src/components/ThemeToggle.tsx` | ~30 | Component | Dark/light toggle |
| `src/components/ui/FilterChips.tsx` | ~50 | UI | Radio chip selector |
| `src/components/ui/PixelBadge.tsx` | ~40 | UI | Label badge |
| `src/components/ui/PixelButton.tsx` | ~50 | UI | Styled button |
| `src/components/ui/PixelCard.tsx` | ~40 | UI | Card container |
| `src/components/ui/ScoreRing.tsx` | ~60 | UI | SVG score ring |
| `src/components/ui/Skeleton.tsx` | ~80 | UI | Loading skeletons |
| `src/components/ui/SortDropdown.tsx` | ~35 | UI | Styled select |
| `src/components/ui/Tabs.tsx` | ~60 | UI | Tab navigation |
| `src/components/ui/VerdictBadge.tsx` | ~35 | UI | Verdict label badge |
| `src/hooks/useTheme.tsx` | ~55 | Hook | Theme context + toggle |
| `src/lib/api.ts` | ~260 | Client | Frontend API wrapper |
| `src/lib/types.ts` | ~160 | Types | All frontend interfaces |
| `src/lib/utils.ts` | ~70 | Utility | UI helpers |
| `src/lib/api/response.ts` | ~25 | Utility | JSON response helpers |
| `src/lib/db/mappers.ts` | ~120 | Mapper | DB → frontend model |
| `src/lib/external/rawg.ts` | ~230 | External | RAWG API client |
| `src/lib/external/steam.ts` | ~310 | External | Steam API client |
| `src/lib/external/igdb.ts` | ~460 | External | IGDB/Twitch API client |
| `src/lib/external/cheapshark.ts` | ~275 | External | CheapShark API client |
| `src/lib/external/wikipedia.ts` | ~120 | External | Wikipedia API client |
| `src/lib/services/ingest.ts` | ~575 | Service | Multi-source ingestion pipeline |
| `src/lib/supabase/client.ts` | ~30 | DB | Browser Supabase client |
| `src/lib/supabase/server.ts` | ~33 | DB | Server Supabase client |
| `src/lib/supabase/index.ts` | ~8 | DB | Barrel export |
| `src/lib/supabase/types.ts` | ~180 | DB | Database type definitions |
| `src/lib/utils/score.ts` | ~18 | Utility | Server-safe score mapping |
| `src/lib/utils/slugify.ts` | ~18 | Utility | URL slug generator |
| `scripts/ingest-full-library.mjs` | ~300 | Script | Bulk game ingestion |
| `scripts/seed-flags.mjs` | ~40 | Script | Set trending/featured flags |
| `scripts/refresh-games.mjs` | ~30 | Script | Re-ingest specific games |
| `scripts/refresh-all-games.mjs` | ~50 | Script | Re-ingest all games |
| `scripts/heroku-discover-games.mjs` | ~20 | Script | Heroku cron: discover |
| `scripts/heroku-refresh-trending.mjs` | ~20 | Script | Heroku cron: trending |
| `scripts/apply-schema.mjs` | ~20 | Script | Apply SQL schema |
| `scripts/apply-migration-001.mjs` | ~20 | Script | Apply migration 001 |
| `scripts/migrate-score-columns.mjs` | ~40 | Script | Add score columns |
| `scripts/migrate-players-updated-at.mjs` | ~20 | Script | Add players_updated_at |

---

*This documentation covers every file, function, component, database table, API route, external integration, design token, animation, and configuration in the verdict.games codebase. Generated from a complete line-by-line review of the entire project.*
