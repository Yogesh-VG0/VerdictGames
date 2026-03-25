# verdict.games — Complete Project Documentation

> **The Verdict on Every Game** — A premium game reviews and discovery platform built for players who want honest, data-driven opinions on games across all major platforms (PC, PlayStation, Xbox, Nintendo Switch, Android, iOS, and more). Think of it as a Letterboxd for games, enriched with data from 7 external APIs (RAWG, Steam, IGDB, CheapShark, Wikipedia, HowLongToBeat, GX Corner).

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
   - [HowLongToBeat API](#76-howlongtobeat-api)
   - [GX Corner APIs (8 feeds)](#77-gx-corner-apis)
8. [Backend — API Routes](#8-backend--api-routes)
   - [Auth Routes](#81-auth-routes)
   - [Homepage Aggregator](#82-homepage-aggregator)
   - [Game Routes](#83-game-routes)
   - [Discovery / Search / Recommendations Routes](#84-discovery--search--recommendations-routes)
   - [Review Routes](#85-review-routes-reviews-votes-comments)
   - [List Routes](#86-list-routes)
   - [Profile Routes](#87-profile-routes)
   - [Library Routes](#88-library-routes)
   - [Social Routes (Follows)](#89-social-routes-follows)
   - [Calendar Routes](#810-calendar-routes)
   - [Compare Routes](#811-compare-routes)
   - [Developer Routes](#812-developer-routes)
   - [Ingestion Routes](#813-ingestion-routes)
   - [Cron Routes](#814-cron-routes)
   - [GX Corner Proxy Routes](#815-gx-corner-proxy-routes)
   - [RAWG Curated Lists](#816-rawg-curated-lists)
   - [Admin Routes](#817-admin-routes)
9. [Service Layer](#9-service-layer)
10. [Ingestion Pipeline](#10-ingestion-pipeline)
11. [Frontend — Pages](#11-frontend--pages)
    - [Home Page](#111-home-page)
    - [Game Detail Page](#112-game-detail-page)
    - [Search Page](#113-search-page)
    - [Reviews Page](#114-reviews-page)
    - [Lists Page](#115-lists-page)
    - [Profile Page](#116-profile-page)
    - [Library Page](#117-library-page)
    - [Compare Page](#118-compare-page)
    - [Release Calendar Page](#119-release-calendar-page)
    - [Developer Hub Page](#1110-developer-hub-page)
    - [Explore Page](#1111-explore-page)
    - [Static Pages (About, Privacy, Terms)](#1112-static-pages)
    - [Admin Dashboard](#1113-admin-dashboard)
12. [Frontend — Components](#12-frontend--components)
    - [Layout Components](#121-layout-components)
    - [Display Components](#122-display-components)
    - [UI Primitives](#123-ui-primitives)
    - [GX Corner Components](#124-gx-corner-components)
13. [Design System](#13-design-system)
    - [Color Tokens](#131-color-tokens)
    - [Typography](#132-typography)
    - [Animations & Transitions](#133-animations--transitions)
    - [Visual Effects](#134-visual-effects)
14. [State Management & Data Fetching](#14-state-management--data-fetching)
15. [Theming (Dark / Light Mode)](#15-theming-dark--light-mode)
16. [Client-Side API Layer](#16-client-side-api-layer)
17. [TypeScript Types](#17-typescript-types)
18. [Utility Functions](#18-utility-functions)
19. [Scripts](#19-scripts)
20. [SEO & Metadata](#20-seo--metadata)
21. [Deployment](#21-deployment)
22. [Security](#22-security)
23. [Scoring Algorithm](#23-scoring-algorithm)
24. [Complete File Reference](#24-complete-file-reference)
25. [Recent Changes Log](#25-recent-changes-log)

---

## 1. Project Overview

**verdict.games** is a full-stack, production-ready game reviews platform that aggregates data from multiple external APIs to provide comprehensive game profiles with:

- **1000+ games** in the database with data from RAWG, Steam, IGDB, CheapShark, Wikipedia, HowLongToBeat, and GX Corner
- **Auto-discovery** — cron endpoints that find and ingest trending, new, and top-rated games automatically (~320 games/standard run, ~700+ games/deep run)
- **Rich game pages** — multi-source scoring, verdict badges, pros/cons, pricing, media, external links, achievements, news
- **Search & filter** — by platform (PC, PS5, PS4, Xbox, Switch, Android, iOS, Linux), genre, year, monetization, with full-text search and on-demand ingestion
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
│   ├── apply-migration-003.mjs
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
│   │   ├── admin/              # Admin dashboard pages
│   │   │   ├── layout.tsx      # Sidebar nav + role guard
│   │   │   ├── page.tsx        # Dashboard overview
│   │   │   ├── games/
│   │   │   │   ├── page.tsx    # Searchable game table
│   │   │   │   ├── new/page.tsx  # Create new game
│   │   │   │   └── [id]/page.tsx # Game editor form
│   │   │   ├── reviews/page.tsx  # Review moderation
│   │   │   └── users/page.tsx    # User management
│   │   │
│   │   ├── api/                # API route handlers
│   │   │   ├── admin/
│   │   │   │   ├── stats/route.ts             # GET — admin stats
│   │   │   │   ├── games/
│   │   │   │   │   ├── route.ts               # GET — paginated game list
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── route.ts           # GET/PATCH — view/edit game
│   │   │   │   │       └── ingest/route.ts    # POST — force re-ingest
│   │   │   │   ├── reviews/route.ts           # GET/POST/DELETE — review CRUD
│   │   │   │   └── featured/route.ts          # POST — toggle flags
│   │   │   ├── auth/
│   │   │   │   ├── callback/route.ts          # GET — OAuth callback exchange
│   │   │   │   └── me/route.ts                # GET — current user
│   │   │   ├── calendar/route.ts              # GET — release calendar
│   │   │   ├── compare/route.ts               # GET — compare two games
│   │   │   ├── cron/
│   │   │   │   ├── discover/route.ts        # GET — auto-discover games
│   │   │   │   └── refresh-trending/route.ts # GET — update trending flags
│   │   │   ├── gx/
│   │   │   │   ├── highlights/route.ts      # GET — GX hero highlights
│   │   │   │   ├── calendar/route.ts        # GET — GX release calendar
│   │   │   │   ├── free-to-play/route.ts    # GET — GX free-to-play
│   │   │   │   ├── top-games/route.ts       # GET — GX PS Plus/Game Pass
│   │   │   │   ├── deals/route.ts           # GET — GX super deals
│   │   │   │   ├── top-liked/route.ts       # GET — GX most liked
│   │   │   │   └── news/
│   │   │   │       ├── popular/route.ts     # GET — GX trending news
│   │   │   │       └── feed/route.ts        # GET — GX full news feed
│   │   │   ├── developers/
│   │   │   │   └── [slug]/route.ts            # GET — developer hub data
│   │   │   ├── follow/route.ts                # POST — follow/unfollow user
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
│   │   │   │   └── stats/route.ts           # GET — site stats (games/reviews/users)
│   │   │   ├── ingest/
│   │   │   │   ├── game/route.ts            # POST — ingest single game
│   │   │   │   └── batch/route.ts           # POST — batch ingest
│   │   │   ├── lists/
│   │   │   │   ├── route.ts                 # GET — all curated lists
│   │   │   │   └── [slug]/route.ts          # GET — single list
│   │   │   ├── profile/
│   │   │   │   └── [username]/route.ts      # GET — user profile
│   │   │   ├── recommendations/route.ts     # GET — personalized recommendations
│   │   │   ├── reviews/
│   │   │   │   ├── route.ts                 # GET/POST — global reviews feed + submit
│   │   │   │   └── [id]/
│   │   │   │       ├── comments/route.ts    # GET/POST — review comments
│   │   │   │       └── vote/route.ts        # POST — vote helpful/unhelpful
│   │   │   └── search/route.ts              # GET — search with filters
│   │   │   └── library/
│   │   │       ├── route.ts                 # GET/POST/DELETE — user library
│   │   │       └── stats/route.ts           # GET — library stats
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
│   │   ├── explore/                         # Explore page (RAWG curated lists)
│   │   │   └── page.tsx
│   │   │
│   │   ├── library/                         # User library page
│   │   │   └── page.tsx
│   │   │
│   │   ├── compare/                         # Game comparison page
│   │   │   └── page.tsx
│   │   │
│   │   ├── calendar/                        # Release calendar page
│   │   │   └── page.tsx
│   │   │
│   │   ├── developers/[slug]/              # Developer hub page
│   │   │   └── page.tsx
│   │   │
│   │   ├── settings/page.tsx                # User settings page
│   │   ├── about/page.tsx                   # About page
│   │   ├── privacy/page.tsx                 # Privacy policy
│   │   └── terms/page.tsx                   # Terms of service
│   │
│   ├── components/                          # Reusable React components
│   │   ├── AuthModal.tsx                    # Login/sign-up modal (email + OAuth)
│   │   ├── GXDealCard.tsx                   # GX deal card (discount, store, price)
│   │   ├── GXNewsCard.tsx                   # GX news article card
│   │   ├── GXServiceBadge.tsx               # PS Plus / Game Pass badge
│   │   ├── BottomNav.tsx                    # Mobile bottom navigation
│   │   ├── FadeInSection.tsx                # Scroll-reveal animation wrapper
│   │   ├── FeaturedHero.tsx                 # Static featured game hero
│   │   ├── GameCard.tsx                     # Game card (default + spotlight)
│   │   ├── GameGrid.tsx                     # Animated game grid with stagger
│   │   ├── HeroCarousel.tsx                 # Auto-advancing hero carousel
│   │   ├── HorizontalScroll.tsx             # Horizontal scroll with arrows
│   │   ├── LibraryStatusSelector.tsx        # Add/remove + status picker for library
│   │   ├── MediaCarousel.tsx                # Image gallery with thumbnails
│   │   ├── NavbarTop.tsx                    # Top navigation bar
│   │   ├── CommentThread.tsx                # Threaded review comments UI
│   │   ├── ReviewCard.tsx                   # Review display card
│   │   ├── ReviewForm.tsx                   # Review submission UI
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
│   │   ├── useAuth.tsx                      # Auth context/provider (Supabase Auth)
│   │   └── useTheme.tsx                     # Theme context + localStorage
│   │
│   └── lib/                                 # Core application logic
│       ├── admin.ts                         # Admin access control (email list + guard)
│       ├── api.ts                           # Client-side API functions
│       ├── types.ts                         # Frontend TypeScript interfaces
│       ├── utils.ts                         # UI utilities (score colors, formatting)
│       ├── api/
│       │   └── response.ts                  # JSON response helpers (jsonOk, jsonError)
│       ├── db/
│       │   └── mappers.ts                   # DB row → frontend model mappers
│       ├── external/
│       │   ├── cheapshark.ts                # CheapShark API client
│       │   ├── gxcorner.ts                  # GX Corner API client (8 feeds)
│       │   ├── howlongtobeat.ts             # HowLongToBeat API client
│       │   ├── igdb.ts                      # IGDB/Twitch API client
│       │   ├── rawg.ts                      # RAWG API client
│       │   ├── steam.ts                     # Steam API client
│       │   └── wikipedia.ts                 # Wikipedia REST API client
│       ├── services/
│       │   └── ingest.ts                    # Multi-source ingestion pipeline
│       ├── supabase/
│       │   ├── auth.ts                     # Server-side auth helpers (getCurrentUser)
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
        ├── 002_security_lint_fixes.sql      # Security lint fixes
        └── 004_admin_role.sql              # Admin role column + constraint
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
- Vercel Cron schedules: refresh-trending (every 6h), discover (daily 3 AM UTC), deep discover (Sundays 3 AM UTC)

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

### `.env` vs `.env.local`
- **Next.js runtime**: Use `.env.local` (recommended) or platform environment variables (Vercel/Heroku).
- **Scripts**: Some scripts load `../.env` directly (not `.env.local`). If you use the provided scripts to apply schema/migrations, keep a root `.env` with at least `DATABASE_URL` set.

**Graceful degradation**: If Supabase env vars are missing, most public GET routes return empty arrays instead of errors, and the frontend renders empty states. Authenticated routes return `401`.

---

## 6. Database Schema (Supabase)

The database runs on Supabase-managed PostgreSQL with the `pgcrypto` extension for UUID generation.

### 6.1 Tables

#### `profiles`
User profile data.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PRIMARY KEY |
| `auth_id` | UUID | — | UNIQUE, FK → `auth.users(id)` (migration 003) |
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
| `platforms` | TEXT[] | `'{}'` | NOT NULL — supports `PC`, `PlayStation 5`, `PlayStation 4`, `Xbox Series X|S`, `Xbox One`, `Nintendo Switch`, `Nintendo Switch 2`, `Android`, `iOS`, `macOS`, `Linux` |
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
| `owner_id` | UUID | Nullable — FK → `profiles(id)` (migration 003) |
| `is_public` | BOOLEAN | Default `true` (migration 003) |
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

#### `user_games`
User library/backlog table (wishlist/playing/completed/etc.) with optional personal rating and hours played.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `user_id` | UUID | FK → `profiles(id)` |
| `game_id` | UUID | FK → `games(id)` |
| `status` | TEXT | `wishlist \| playing \| completed \| dropped \| paused` |
| `personal_rating` | INTEGER | Nullable, 0–100 |
| `hours_played` | NUMERIC(8,1) | Default 0 |
| `notes` | TEXT | Default `''` |
| `started_at` | DATE | Nullable |
| `completed_at` | DATE | Nullable |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` (trigger) |

**Unique constraint**: `(user_id, game_id)` — prevents duplicates in a user’s library.

#### `follows`
Follower/following edges between profiles.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `follower_id` | UUID | FK → `profiles(id)` |
| `following_id` | UUID | FK → `profiles(id)` |
| `created_at` | TIMESTAMPTZ | `now()` |

**Unique constraint**: `(follower_id, following_id)` — prevents duplicate follow edges.

#### `review_comments`
Threaded comments on reviews (supports replies via `parent_id`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `review_id` | UUID | FK → `reviews(id)` |
| `profile_id` | UUID | FK → `profiles(id)` |
| `body` | TEXT | 1–2000 chars |
| `parent_id` | UUID | Nullable — FK → `review_comments(id)` |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` (trigger) |

#### `review_votes`
Helpful/unhelpful voting on reviews. Values are `1` or `-1`. A trigger keeps `reviews.helpful` in sync with the sum.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `review_id` | UUID | FK → `reviews(id)` |
| `profile_id` | UUID | FK → `profiles(id)` |
| `value` | SMALLINT | `-1` or `1` |
| `created_at` | TIMESTAMPTZ | `now()` |

#### `player_snapshots` (Migration 002)
Hourly player count snapshots for momentum calculation.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `game_id` | UUID | FK → `games(id)` ON DELETE CASCADE |
| `player_count` | INTEGER | NOT NULL, default 0 |
| `recorded_at` | TIMESTAMPTZ | NOT NULL, default `now()` |

**Index**: `(game_id, recorded_at DESC)` for efficient latest-snapshot queries.

#### `steam_reviews` (Migration 012)
Imported Steam player reviews (separate from community `reviews` table).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `game_id` | UUID | FK → `games(id)` ON DELETE CASCADE |
| `steam_app_id` | INTEGER | NOT NULL |
| `recommendation_id` | TEXT | NOT NULL |
| `language` | TEXT | Default `'english'` |
| `voted_up` | BOOLEAN | NOT NULL — true = positive |
| `review_text` | TEXT | NOT NULL |
| `playtime_at_review` | INTEGER | Minutes at time of review |
| `playtime_forever` | INTEGER | Total minutes played |
| `author_steam_id` | TEXT | Nullable |
| `authored_at` | TIMESTAMPTZ | When the review was written |
| `votes_up` | INTEGER | Helpful votes |
| `votes_funny` | INTEGER | Funny votes |
| `weighted_vote_score` | REAL | Steam's quality score |
| `steam_purchase` | BOOLEAN | Default true |
| `received_for_free` | BOOLEAN | Default false |

**Unique constraint**: `(game_id, recommendation_id)` — prevents duplicate reviews.

#### `ingest_runs` (Migration 012)
Pipeline execution history for observability.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `run_type` | TEXT | NOT NULL — e.g. `'discover'`, `'backfill'`, `'trending'` |
| `status` | TEXT | Default `'running'` |
| `started_at` | TIMESTAMPTZ | NOT NULL, default `now()` |
| `finished_at` | TIMESTAMPTZ | Nullable |
| `games_processed` | INTEGER | Default 0 |
| `games_created` | INTEGER | Default 0 |
| `games_updated` | INTEGER | Default 0 |
| `errors` | INTEGER | Default 0 |
| `error_details` | JSONB | Default `'[]'` |
| `metadata` | JSONB | Default `'{}'` |

#### `admin_audit_log` (Migration 009)
Tracks all admin changes for accountability.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `entity_type` | TEXT | NOT NULL — `'game'`, `'review'`, `'list'`, `'profile'` |
| `entity_id` | TEXT | NOT NULL — ID of modified entity |
| `action` | TEXT | NOT NULL — `'create'`, `'update'`, `'delete'` |
| `field_changes` | JSONB | Default `'{}'` — `{ field: { old, new } }` |
| `edited_by` | TEXT | Profile ID or email of admin |
| `edited_at` | TIMESTAMPTZ | Default `now()` |
| `reason` | TEXT | Optional explanation |

#### `mobile_store_listings`
Verified mobile store listings for Android (Google Play) and iOS (App Store) games.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `game_id` | UUID | FK → `games(id)` ON DELETE CASCADE |
| `store` | TEXT | `'google_play'` or `'app_store'` |
| `external_id` | TEXT | Store-specific app ID |
| `store_url` | TEXT | Full store URL |
| `store_name` | TEXT | App name as listed in store |
| `store_developer` | TEXT | Developer as listed in store |
| `store_rating` | REAL | Store rating |
| `store_rating_count` | INTEGER | Number of ratings |
| `store_price` | TEXT | Price string |
| `is_verified` | BOOLEAN | Default false |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

**Unique constraint**: `(store, external_id)` — prevents duplicate listings.

#### `scheduler_runs`
Tracks Heroku/Vercel scheduler job executions with advisory lock support.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PRIMARY KEY |
| `job_name` | TEXT | NOT NULL — e.g. `'refresh-trending'`, `'re-enrich'` |
| `status` | TEXT | `'running'`, `'completed'`, `'failed'` |
| `started_at` | TIMESTAMPTZ | NOT NULL |
| `finished_at` | TIMESTAMPTZ | Nullable |
| `metadata` | JSONB | Job-specific output data |
| `error` | TEXT | Error message if failed |

**Additional `games` columns from later migrations:**

| Column | Migration | Type | Notes |
|--------|-----------|------|-------|
| `momentum` | 002 | REAL | Log-based player count momentum |
| `hltb_main` | 004 | NUMERIC(6,1) | Main story completion hours |
| `hltb_extras` | 004 | NUMERIC(6,1) | Main + extras hours |
| `hltb_completionist` | 004 | NUMERIC(6,1) | 100% completion hours |
| `hltb_last_fetched` | 004 | TIMESTAMPTZ | When HLTB data was last fetched |
| `franchise` | 004 | TEXT | Game franchise name |
| `is_featured_manual` | 006 | BOOLEAN | Admin pinned to featured |
| `is_trending_manual` | 006 | BOOLEAN | Admin pinned to trending |
| `manual_score` | 006 | INTEGER | Admin score override |
| `is_refreshing` | 007 | BOOLEAN | Re-enrichment lock |
| `refresh_started_at` | 008 | TIMESTAMPTZ | Lock start time |
| `is_provisional` | 009 | BOOLEAN | Provisional/upcoming game flag |
| `release_status` | 009 | TEXT | Release status string |
| `steam_positive_count` | 015 | INTEGER | Raw positive review count |
| `steam_total_count` | 015 | INTEGER | Raw total review count |
| `community_score` | 015 | REAL | Wilson Lower Bound × 100 |
| `critic_score` | 015 | REAL | Normalized critic average |
| `critic_source_count` | 015 | INTEGER | Number of critic sources |
| `confidence` | 015 | REAL | 0.0–1.0 trust level |
| `verdict_score` | 015 | REAL | Final blended score 0–100 |

**Additional `profiles` columns:**

| Column | Migration | Type | Notes |
|--------|-----------|------|-------|
| `auth_id` | 004 | UUID | FK → `auth.users(id)`, UNIQUE |
| `role` | 005 | TEXT | `'user'` or `'admin'` |

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
idx_profiles_auth_id           — profiles(auth_id) WHERE auth_id IS NOT NULL
idx_user_games_unique          — user_games(user_id, game_id) UNIQUE
idx_user_games_user_id         — user_games(user_id)
idx_user_games_game_id         — user_games(game_id)
idx_user_games_status          — user_games(user_id, status)
idx_follows_unique             — follows(follower_id, following_id) UNIQUE
idx_follows_follower           — follows(follower_id)
idx_follows_following          — follows(following_id)
idx_review_comments_review      — review_comments(review_id)
idx_review_comments_parent      — review_comments(parent_id) WHERE parent_id IS NOT NULL
idx_review_votes_unique         — review_votes(review_id, profile_id) UNIQUE
idx_review_votes_review         — review_votes(review_id)
```

### 6.3 Triggers

A single trigger function `update_updated_at_column()` automatically sets `updated_at = now()` on UPDATE for:
- `games`
- `profiles`
- `reviews`
- `lists`
 - `user_games` (migration 003)
 - `review_comments` (migration 003)

The function uses `SET search_path = ''` to prevent search_path injection attacks.

### 6.4 Row Level Security (RLS)

RLS is enabled on **all 13 tables**:
`games`, `profiles`, `game_sources`, `reviews`, `lists`, `list_items`, `user_games`, `follows`, `review_comments`, `review_votes`, `player_snapshots`, `steam_reviews`, `ingest_runs`, `admin_audit_log`, `mobile_store_listings`, `scheduler_runs`

**Read policies** (public — `FOR SELECT USING (true)`):
- All tables permit public reads

**Service-role write policies** (`TO service_role`):
- Full INSERT/UPDATE/DELETE access for server-side API routes
- Tables: `games`, `game_sources`, `reviews`, `lists`, `list_items`, `player_snapshots`, `steam_reviews`, `ingest_runs`, `admin_audit_log`, `mobile_store_listings`, `scheduler_runs`

**Authenticated user self-management policies** (migration 004, optimized in 010/014):
- `user_games` — users can insert/update/delete their own entries (scoped by `auth_profile_id()`)
- `follows` — users can insert/delete their own follows
- `review_comments` — users can insert/update/delete their own comments
- `review_votes` — users can insert/update/delete their own votes
- `reviews` — users can insert/update their own reviews
- `lists` — users can insert/update their own lists (scoped by `owner_id`)
- `profiles` — users can update their own profile (scoped by `auth_id = auth.uid()`)

**Performance optimization** (migration 014): All user-scoped policies use `(select public.auth_profile_id())` instead of inline subqueries to prevent per-row re-evaluation.

**Storage RLS** (migration 011): `avatars` bucket — authenticated upload/update, public read.

### 6.5 Migrations

**Migration 001: `001_multi_source.sql`**
- Adds 25+ columns to `games` table for multi-source enrichment:
  - Price & deals (CheapShark + Steam): `price_current`, `price_currency`, `price_lowest`, `price_deal_url`, `is_free`
  - Player counts (Steam): `current_players`, `peak_players_24h`
  - Trailer media (IGDB/YouTube): `trailer_url`, `trailer_thumbnail`
  - IGDB cross-reference: `igdb_id`, `igdb_url`, `igdb_rating`, `igdb_summary`
  - Wikipedia: `wikipedia_url`, `wikipedia_excerpt`
  - Additional external links: `metacritic_url`, `website_url`, `reddit_url`
  - CheapShark mapping: `cheapshark_id`
  - Enrichment tracking: `last_enriched_at`, `enrichment_sources`
- Creates 5 new partial indexes

**Migration 002: `002_player_snapshots.sql`**
- Creates `player_snapshots` table for hourly player count snapshots (momentum calculation)
- Adds `momentum` column (REAL, default 0) to `games` table — uses `ln(current+1) - ln(previous+1)` formula
- Index: `idx_games_momentum`, `idx_player_snapshots_game_time`
- RLS: public read, service_role insert/delete

**Migration 003: `003_security_lint_fixes.sql`**
- Fixes Supabase linter warnings:
  - `function_search_path_mutable` — pins `search_path = ''` on trigger function
  - `rls_policy_always_true` — rescopes service write policies to `TO service_role`

**Migration 004: `004_user_features.sql`**
- Adds Supabase Auth linkage and user features:
  - `profiles.auth_id` FK → `auth.users`
  - New tables: `user_games`, `follows`, `review_comments`, `review_votes`
  - Adds list ownership/public fields: `lists.owner_id`, `lists.is_public`
  - Adds HLTB + franchise fields to games: `hltb_main`, `hltb_extras`, `hltb_completionist`, `hltb_last_fetched`, `franchise`
- Adds a trigger on `auth.users` to auto-create a `profiles` row on signup (`handle_new_user()`)
- Adds a trigger to sync `reviews.helpful` from votes (`sync_review_helpful_count()`)
- Full RLS policies for user-owned tables (insert/update/delete scoped to owning user via `auth.uid()`)

**Migration 005: `005_admin_role.sql`**
- Adds `role` column to `profiles` table (`TEXT NOT NULL DEFAULT 'user'`)
- CHECK constraint: `role IN ('user', 'admin')`
- Partial index: `idx_profiles_role` on `profiles(role) WHERE role = 'admin'` for fast admin lookups

**Migration 006: `006_admin_overrides.sql`**
- Adds manual override fields to `games` table:
  - `is_featured_manual` (BOOLEAN, default false) — admin can pin games to Featured
  - `is_trending_manual` (BOOLEAN, default false) — admin can pin games to Trending
  - `manual_score` (INTEGER, nullable) — admin score override
- Partial indexes on `is_featured_manual` and `is_trending_manual` for fast lookups
- The cron `refresh-trending` preserves manual overrides when resetting algorithmic flags

**Migration 007: `007_refresh_lock.sql`**
- Adds `is_refreshing` (BOOLEAN, default false) to `games` — prevents duplicate on-demand refresh

**Migration 008: `008_refresh_started_at.sql`**
- Adds `refresh_started_at` (TIMESTAMPTZ) to `games` — lock expiry based on refresh start time

**Migration 009: `009_provisional_and_audit.sql`**
- Adds `is_provisional` (BOOLEAN, default false) and `release_status` (TEXT) to `games`
- Creates `admin_audit_log` table for tracking admin changes:
  - Columns: `entity_type`, `entity_id`, `action`, `field_changes` (JSONB), `edited_by`, `edited_at`, `reason`
  - Indexes on `(entity_type, entity_id)` and `edited_at DESC`

**Migration 010: `010_rls_refactor.sql`**
- Creates `auth_profile_id()` helper function (SECURITY DEFINER, pinned search_path) — maps `auth.uid()` → `profiles.id`
- Enables RLS on `admin_audit_log` with service_role + public read policies
- Replaces all inline subqueries in user-scoped RLS policies with `auth_profile_id()` for performance

**Migration 011: `011_storage_avatars.sql`**
- Creates `avatars` storage bucket (public, 2MB limit, jpeg/png/webp only)
- RLS policies: authenticated users can upload/update own avatar, public read access

**Migration 012: `012_steam_reviews_and_ingest_runs.sql`**
- Creates `steam_reviews` table for imported Steam player reviews (separate from community reviews):
  - Columns: `game_id`, `steam_app_id`, `recommendation_id`, `language`, `voted_up`, `review_text`, `playtime_at_review`, `playtime_forever`, `author_steam_id`, `authored_at`, `votes_up`, `votes_funny`, `weighted_vote_score`, `steam_purchase`, `received_for_free`
  - Unique on `(game_id, recommendation_id)`
  - Indexes: `game_id`, `steam_app_id`, `(game_id, weighted_vote_score DESC)`
- Creates `ingest_runs` table for pipeline execution history:
  - Columns: `run_type`, `status`, `started_at`, `finished_at`, `games_processed`, `games_created`, `games_updated`, `errors`, `error_details` (JSONB), `metadata` (JSONB)
  - Index: `(run_type, started_at DESC)`
- RLS: public read, service_role full access on both tables

**Migration 013: `013_mobile_store_listings_rls.sql`**
- Enables RLS on `mobile_store_listings` table
- Public read access, service_role write access
- Note: the table itself is created via the ingest pipeline / backfill script

**Migration 014: `014_comprehensive_security_fix.sql`**
- **Critical security fix**: 9 "Service" write policies were on `{public}` role instead of `{service_role}` — any anonymous user could INSERT/UPDATE/DELETE games, profiles, reviews, lists, game_sources, list_items, admin_audit_log, steam_reviews, ingest_runs
- Enables RLS on `scheduler_runs` table
- Fixes mutable `search_path` on `update_msl_updated_at` and `update_updated_at_column` functions
- Re-creates `auth_profile_id()` helper
- Optimizes all user-scoped policies to use `(select auth_profile_id())` (prevents per-row re-evaluation)
- Adds missing foreign key indexes: `idx_lists_owner_id`, `idx_review_comments_profile_id`, `idx_review_votes_profile_id`

**Migration 015: `015_verdict_scoring.sql`**
- Adds Verdict Scoring v2 columns to `games`:
  - `steam_positive_count` (INTEGER) — raw positive review count for Wilson Lower Bound
  - `steam_total_count` (INTEGER) — raw total review count
  - `community_score` (REAL) — Wilson Lower Bound × 100, 0-100
  - `critic_score` (REAL) — normalized average of IGDB + Metacritic, 0-100
  - `critic_source_count` (INTEGER, default 0) — how many critic sources contributed
  - `confidence` (REAL, default 0) — 0.0-1.0, trust level in the verdict
  - `verdict_score` (REAL) — final blended community + critic score, 0-100
- Indexes: `idx_games_verdict_score`, `idx_games_confidence`, `idx_games_community_score`
- Composite index: `idx_games_verdict_confidence` on `(verdict_score DESC, confidence DESC) WHERE verdict_score IS NOT NULL`

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
| `extractIgdbEnrichment(game)` | Extract trailer URL, Wikipedia URL, Reddit, official site, cover image, screenshots |
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

### 7.6 HowLongToBeat API
**File**: `src/lib/external/howlongtobeat.ts`
**Integration**: Wired into the ingestion pipeline (`src/lib/services/ingest.ts`)

Fetches playtime estimates by searching the HowLongToBeat API for matching game titles. Populates the following `games` table columns (added in migration 003):

| Column | Type | Notes |
|--------|------|-------|
| `hltb_main` | REAL | Main story completion time (hours) |
| `hltb_extras` | REAL | Main + extras completion time (hours) |
| `hltb_completionist` | REAL | 100% completionist time (hours) |
| `hltb_last_fetched` | TIMESTAMPTZ | When HLTB data was last retrieved |

**Used for**: Game detail page stats, comparison page HLTB column.

### 7.7 GX Corner APIs
**File**: `src/lib/external/gxcorner.ts`
**Base URLs**:
- Game data: `https://proxy.gxcorner.games`
- News data: `https://api.news.gxcorner.games`

**Auth**: None required (public APIs, CORS-enabled)
**Cache**: 5 minutes (`next: { revalidate: 300 }` with 15-second timeout)

8 public feeds providing real-time gaming industry data:

| # | Feed | Function | Description |
|---|------|----------|-------------|
| API 2 | Highlights | `getGXHighlights()` | Hero carousel highlights with trailers, prices, tags |
| API 3 | Calendar | `getGXCalendar()` | Release calendar with platform/CTA info |
| API 4 | Free-to-Play | `getGXFreeToPlay()` | Free-to-play games sorted by order |
| API 5 | Top Games | `getGXTopGames()` | PS Plus / Game Pass featured titles |
| API 6 | Super Deals | `getGXDeals()` | Discounted games with deal type, store, prices |
| API 7 | Top Liked | `getGXTopLiked()` | Most anticipated games ranked by community likes |
| API 8a | Popular News | `getGXPopularNews()` | Trending gaming news articles |
| API 8b | News Feed | `getGXNewsFeed()` | Full gaming news feed |

**TypeScript types** (exported from `src/lib/external/gxcorner.ts` and re-exported via `src/lib/types.ts`):
- `GXHighlight`, `GXCalendarEntry`, `GXGameListEntry`, `GXDealEntry`, `GXTopLikedGame`, `GXNewsArticle`
- Supporting types: `GXGenre`, `GXPlatform`, `GXStore`, `GXPrice`, `GXGameDetail`

**Used for**: Homepage sections (Hot Right Now, Best Deals, Free to Play, PS Plus & Game Pass, Gaming News), trending signal in refresh-trending cron.

---

## 8. Backend — API Routes

All API routes follow a consistent pattern:
1. Check if Supabase environment variables are configured
2. If not configured, return empty data/arrays (graceful fallback)
3. If configured, query Supabase using the server client (service_role key)
4. Map database rows to frontend models using `mapGameRow`, `mapReviewRow`, etc.
5. Return `{ success: true, data: ... }` envelope via `jsonOk()`
6. Catch errors and return empty data or `{ success: false, error: "..." }` via `jsonError()`

### 8.1 Auth Routes

#### `GET /api/auth/me`
- Returns the current authenticated user (Supabase auth user + matching `profiles` row).
- **Auth**: Required (returns 401 if not authenticated).

#### `GET /api/auth/callback`
- OAuth callback handler. Exchanges `code` for session cookies and redirects.
- **Security**: validates `next` is a safe relative path to prevent open redirects.

#### `POST /api/auth/bootstrap`
- Ensures a `profiles` row exists for the authenticated Supabase user.
- Critical for OAuth logins (Google, Discord) when DB triggers haven't been applied.
- **Auth**: Required (returns 401 if not authenticated).
- Creates profile from user metadata: username (sanitized), display_name, avatar_url.
- Handles both `auth_id` (new schema) and `id` (legacy schema) profile lookups.
- Returns: `{ created: true }` (new profile) or `{ created: false }` (already exists).

### 8.2 Homepage Aggregator

#### `GET /api/homepage`
- Single aggregator endpoint that returns all homepage sections in one call.
- Eliminates 5+ separate API calls from the frontend.
- **ISR**: `revalidate = 60` (60-second cache).
- Calls `fetchHomepageData()` from `src/lib/services/homepage.ts`.
- Returns: `{ hero, trending, topRated, newReleases, deals }` — each section contains an array of mapped `Game` objects.
- **Graceful fallback**: Returns empty arrays if Supabase is not configured or on error.

### 8.3 Game Routes

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

#### `GET /api/games/[slug]/steam-reviews`
- Returns top Steam player reviews for a game.
- Fetches from `steam_reviews` Supabase cache first; if stale (>24h) or empty, refreshes from Steam API.
- **Query params**: `limit` (default: 3, max: 10)
- **Cache strategy**: 24-hour TTL; stale cache returned if Steam API fails.
- Upserts fetched reviews into `steam_reviews` table (conflict key: `game_id,recommendation_id`).
- Returns: `{ reviews[], total, steamAppId, gameTitle, coverImage, source }` where source is `"cache"`, `"stale-cache"`, or `"fresh"`.
- Each review includes: recommendationId, votedUp, reviewText, playtimeAtReview, playtimeForever, authorSteamId, authoredAt, votesUp, votesFunny, weightedVoteScore, steamPurchase.

#### `GET /api/games/stats`
- Returns site-wide counts: `{ totalGames, totalReviews, totalUsers, enrichmentSources }`

### 8.4 Discovery / Search / Recommendations Routes

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
- **3-layer search pipeline** (when text query returns fewer than 3 DB results and no filters active):
  1. **Layer 1 — Database**: standard Supabase full-text / ilike search
  2. **Layer 2 — RAWG instant preview**: if DB returns < 3 results, searches RAWG API for immediate preview cards (shown instantly to the user)
  3. **Layer 3 — Background ingest**: triggers full multi-source ingestion; if successful, replaces the RAWG preview with the fully enriched game
- This makes search feel **instant and unlimited** — every game in existence is searchable via RAWG fallback
- Page size: 12

#### `GET /api/recommendations`
- Returns personalized recommendations.
- **Anonymous users**: genre-diverse, top-scored picks.
- **Authenticated users**: derives preferred genres from `user_games` and excludes games already in library.
- **Query params**: `limit` (default: 8)

### 8.5 Review Routes (Reviews, Votes, Comments)

#### `GET /api/reviews`
- Returns the global reviews feed across all games
- **Query params**: `sort` (`newest` | `helpful`), `platform` (`PC` | `Android` | `All`), `page`
- Joins with `games` and `profiles` tables
- Page size: 12

#### `POST /api/reviews`
- Submits a new review for a game.
- **Auth**: Required.
- Prevents duplicates per `(profile_id, game_id)`.
- Body: `{ gameId, rating, title, bodyText, pros?, cons?, platform? }`

#### `POST /api/reviews/[id]/vote`
- Votes on a review (`value: 1 | -1`).
- **Auth**: Required.
- Upserts into `review_votes` (unique by `(review_id, profile_id)`).
- DB trigger keeps `reviews.helpful` synced to sum of votes.

#### `GET /api/reviews/[id]/comments`
- Returns nested comment threads for a review.
- Public read.

#### `POST /api/reviews/[id]/comments`
- Adds a comment or reply (`parentId` optional).
- **Auth**: Required.
- Validates body length (1–2000).

### 8.6 List Routes

#### `GET /api/lists`
- Returns all curated lists with their games
- For each list: fetches `list_items` → resolves `game_id` → maps to full Game objects
- Games are ordered by `position` within each list

#### `GET /api/lists/[slug]`
- Returns a single list by slug with ordered games
- Returns 404 if not found

### 8.7 Profile Routes

#### `GET /api/profile/[username]`
- Returns a user profile by username with stats.
- Returns: libraryCount, followerCount, followingCount via parallel queries.
- Builds real recentActivity from reviews + user_games (merged, sorted, limited to 15).
- List count uses `owner_id`.
- Returns 404 if not found.

#### `PATCH /api/profile/settings`
- Updates the current user's profile fields.
- **Auth**: Required.
- **Allowed fields**: `display_name` (max 100 chars), `bio` (max 1000 chars), `avatar_url`, `favorite_genres` (max 20).
- Resolves profile by `auth_id` first, falls back to legacy `id`.

#### `POST /api/profile/settings`
- Uploads a user avatar via base64 image.
- **Auth**: Required.
- Body: `{ avatar: "base64...", contentType: "image/png" }`
- Validates: MIME type (JPEG/PNG/WebP only), size (max 2MB).
- Stores in Supabase Storage `avatars` bucket, updates `avatar_url` on profile.
- Returns: `{ avatarUrl }`

### 8.8 Library Routes

#### `GET /api/library`
- Returns the current user’s `user_games` joined with full `games` rows.
- **Auth**: Required.
- **Query params**: `status` (`all` | `wishlist` | `playing` | `completed` | `dropped` | `paused`).

#### `POST /api/library`
- Upserts a library entry for the current user (conflict: `user_id,game_id`).
- **Auth**: Required.
- Body: `{ gameId, status?, personalRating?, hoursPlayed?, notes?, startedAt?, completedAt? }`

#### `DELETE /api/library`
- Removes a game from the current user’s library.
- **Auth**: Required.
- Body: `{ gameId }`

#### `GET /api/library/stats`
- Computes library totals per status, totalHours, averageRating, and genreBreakdown.
- **Auth**: Required.

### 8.9 Social Routes (Follows)

#### `POST /api/follow`
- Follow/unfollow a user profile.
- **Auth**: Required.
- Body: `{ targetProfileId, action: "follow" | "unfollow" }`
- Prevents self-follow.

### 8.10 Calendar Routes

#### `GET /api/calendar`
- Release calendar query over `games.release_date`.
- **Query params**: `month=YYYY-MM` (optional; defaults to next 3 months), `limit` (default 50).
- Returns games ordered by release date ascending.

### 8.11 Compare Routes

#### `GET /api/compare`
- Compare two games by slug.
- **Query params**: `g1` (slug), `g2` (slug).
- Returns `{ game1, game2 }` or 404 if either missing.

### 8.12 Developer Routes

#### `GET /api/developers/[slug]`
- Developer hub data: case-insensitive match over `games.developer`.
- Returns `{ name, slug, gameCount, averageScore, games[] }`.

### 8.13 Ingestion Routes

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

### 8.14 Cron Routes

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
- Updates `trending` and `featured` flags using multi-source signals + **freshnessScore** ranking
- **Flow**:
  1. Fetch IGDB PopScore (weighted: visits 25%, want-to-play 30%, playing 30%, Steam peak 15%)
  1b. Fetch GX Top Liked signal — cross-references most-liked games from GX Corner by slug/title matching; falls back to RAWG trending if GX fails
  2. Cross-reference with database by slug/title matching
  3. RAWG fallback: fetch trending from last 90 days
  4. **FreshnessScore fill** — remaining slots filled using composite score: `recency (30%) + rating (30%) + popularity (20%) + manualBoost (20%)`
  5. Reset algorithmic flags (preserving `is_trending_manual`/`is_featured_manual` overrides)
  6. Set `trending = true` for up to 20 games
  7. Set `featured = true` for top 5 trending by score
- **Manual override preservation**: games with `is_trending_manual = true` or `is_featured_manual = true` are never reset by the cron
- **Auth**: Optional `CRON_SECRET` check
- **Vercel Cron**: Configured in `vercel.json` — runs every 6 hours (`0 */6 * * *`)
- Returns: `{ trendingCount, featuredCount, log[], timestamp }`

**Vercel Cron Configuration** (`vercel.json`):
| Schedule | Path | Description |
|----------|------|-------------|
| `0 */6 * * *` | `/api/cron/refresh-trending` | Refresh trending/featured every 6 hours |
| `0 3 * * *` | `/api/cron/discover` | Daily game discovery at 3 AM UTC |
| `0 3 * * 0` | `/api/cron/discover?deep=true` | Weekly deep discovery (Sundays at 3 AM UTC) |

### 8.15 GX Corner Proxy Routes

Server-side proxy routes for the 8 GX Corner feeds. Each route fetches from the GX Corner API via the client in `src/lib/external/gxcorner.ts` and returns the data directly. All routes use `export const revalidate = 300` for 5-minute ISR caching.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/gx/highlights` | GET | Hero carousel highlights |
| `/api/gx/calendar` | GET | Release calendar |
| `/api/gx/free-to-play` | GET | Free-to-play games |
| `/api/gx/top-games` | GET | PS Plus / Game Pass titles |
| `/api/gx/deals` | GET | Discounted games (Super Deals) |
| `/api/gx/top-liked` | GET | Most anticipated / most liked games |
| `/api/gx/news/popular` | GET | Trending gaming news |
| `/api/gx/news/feed` | GET | Full news feed |

**Files**: `src/app/api/gx/highlights/route.ts`, `src/app/api/gx/calendar/route.ts`, `src/app/api/gx/free-to-play/route.ts`, `src/app/api/gx/top-games/route.ts`, `src/app/api/gx/deals/route.ts`, `src/app/api/gx/top-liked/route.ts`, `src/app/api/gx/news/popular/route.ts`, `src/app/api/gx/news/feed/route.ts`

### 8.16 RAWG Curated Lists

#### `GET /api/rawg/lists`
- Proxy for RAWG curated list endpoints.
- **Query params**:
  - `type` — `best-of-year` | `popular-in-year` | `all-time` | `recent` | `genre` (required)
  - `genre` — RAWG genre slug (required when `type=genre`)
  - `page` — Pagination (default: 1)
- Resolves RAWG slugs to internal DB slugs via batch lookup (falls back to RAWG slug if DB lookup fails).
- Returns: `{ results: RawgListGameItem[], count, next, previous }` where each item has: rawgId, slug, name, backgroundImage, rating, ratingsCount, metacritic, released, added, genres[], platforms[].
- Used by the `/explore` page and homepage "Most Anticipated" section.

### 8.17 Admin Routes

Protected admin API routes for managing games, reviews, and featured flags. All routes are guarded by `requireAdmin()` from `src/lib/admin.ts`, which checks the authenticated user's email against a hardcoded admin email list.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/stats` | GET | Dashboard statistics (game/review/user counts) |
| `/api/admin/games` | GET | Paginated game list with search |
| `/api/admin/games/[id]` | GET | Single game details for editing |
| `/api/admin/games/[id]` | PATCH | Update game fields |
| `/api/admin/games/[id]/ingest` | POST | Force re-ingest a game from external sources |
| `/api/admin/reviews` | GET | List all reviews (paginated) |
| `/api/admin/reviews` | POST | Create a new editorial review |
| `/api/admin/reviews` | DELETE | Delete a review by ID |
| `/api/admin/featured` | POST | Toggle `is_featured_manual` or `is_trending_manual` on a game |
| `/api/admin/games/[id]/delete` | DELETE | Permanently deletes a game and all related records. |
| `/api/admin/audit` | GET | Returns the latest 50 entries from `admin_audit_log`, ordered by `edited_at` DESC. |
| `/api/admin/users` | GET | Paginated list of user profiles with aggregated counts. |
| `/api/admin/backfill-scores` | POST | Recomputes v2 scores (community_score, critic_score, confidence, verdict_score) for all games. |
| `/api/admin/seed-lists` | POST | Seeds 12 editorial curated lists. |
| `/api/admin/seed-lists` | GET | Returns metadata about available seed list definitions. |

**Files**: `src/app/api/admin/stats/route.ts`, `src/app/api/admin/games/route.ts`, `src/app/api/admin/games/[id]/route.ts`, `src/app/api/admin/games/[id]/ingest/route.ts`, `src/app/api/admin/games/[id]/delete/route.ts`, `src/app/api/admin/reviews/route.ts`, `src/app/api/admin/featured/route.ts`, `src/app/api/admin/audit/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/backfill-scores/route.ts`, `src/app/api/admin/seed-lists/route.ts`

---

## 9. Service Layer

### `src/lib/services/ingest.ts` (~575 lines)
Multi-source ingestion pipeline — see Section 10 (Ingestion Pipeline) for full details.

### `src/lib/services/homepage.ts`
- `fetchHomepageData()` — Aggregates all homepage sections in a single function.
- Queries: hero (featured games), trending, topRated, newReleases, deals, recommendations, free-to-play.
- Recency filters: trending 18mo, top rated 24mo (fallback 36mo), recommendations 36mo.
- All queries sort by `verdict_score` first, fall back to legacy `score`.
- Quality gates: `isQualityGame("topRated")` for top-rated (50+ reviews), `isQualityGame("recommended")` for recommendations (20+ reviews).
- Excludes provisional/future/no-cover games from curated sections.

### `src/lib/auditLog.ts` (35 lines)
- Shared helper for writing admin audit log entries from any mutation route.
- Exports: `writeAuditLog(entry: AuditLogEntry)` — best-effort insert into `admin_audit_log` table.
- `AuditLogEntry` interface: entity_type, entity_id, action (`create`|`update`|`delete`), field_changes (Record of old→new diffs), edited_by, reason.
- Failures are caught and logged to console, never block the response.
- Used by: admin game edit, admin review create/delete, admin featured toggle, seed-lists.

---

## 10. Ingestion Pipeline

**File**: `src/lib/services/ingest.ts`

The `ingestGame()` function orchestrates a 13-step multi-source enrichment pipeline:

| Step | Source | Data Enriched |
|------|--------|--------------|
| 1 | **RAWG** | Title, slug, cover image, platforms, genres, release date, description, developer, publisher, screenshots, ESRB rating, metacritic, RAWG rating |
| 2 | **Slug generation** | URL-safe slug from title via `slugify()` |
| 3 | **Duplicate check** | Looks up existing game by RAWG slug in Supabase |
| 4 | **Steam** | Steam App ID resolution, review stats (positive/total/%), current players, price, store URL, rating label |
| 5 | **IGDB** | IGDB ID, aggregated rating, cover image, screenshots, header image, trailer URL, description, game modes, themes, storyline |
| 6 | **CheapShark** | Active deals (store, price, savings %, deal URL) |
| 7 | **Wikipedia** | Summary paragraph, Wikipedia URL |
| 8 | **HowLongToBeat** | Main story hours, completionist hours, HLTB URL |
| 9 | **Score computation** | Legacy waterfall score + v2 Verdict Scoring (community, critic, confidence, verdict_score) |
| 10 | **Smart pros/cons** | Auto-generated from Steam sentiment, player counts, critic scores, genre tags |
| 11 | **Verdict summary** | Auto-generated review summary based on score + genre |
| 12 | **Upsert** | Insert or update game row in Supabase (conflict on `rawg_slug`) |
| 13 | **Mobile verification** | Non-blocking `verifyMobileListings()` — checks Google Play + App Store for Android/iOS games |

**Key behaviors**:
- `forceRefresh: true` re-enriches all sources even if game exists.
- Each external call is wrapped in try/catch — failures are non-fatal, the pipeline continues with partial data.
- `isHighConfidenceMatch()` for mobile stores uses tiered matching (≥90% title = auto, ≥80% title + developer overlap = auto, else skip).
- Rate limiting: 1.5s sleep for Google Play, 3.5s for Apple.

---

## 11. Frontend — Pages

### 11.1 Home Page (`src/app/page.tsx`)
- 11 sections: Hero Carousel, Trending, Most Anticipated, For You (recommendations), Discover (tabbed), Top Rated, New Releases, Deals, Free-to-Play, News, Footer.
- 5 sections powered by GX Corner API (deals, free-to-play, top games, news, calendar).
- Hero carousel: separate selection from trending rail (daily shuffle, deduped).
- Each section uses `HorizontalScroll` for card rail layout.
- 20 games per section.
- Data fetched via `useQuery` with stale times of 5-30 minutes.

### 11.2 Game Detail Page (`src/app/game/[slug]/page.tsx`)
- Richest page (~650 lines). Fetches game data + Steam reviews + deals.
- Sections: Hero banner, title bar with scores, verdict summary, pros/cons, media carousel (screenshots + trailer), game info grid (developer, publisher, release date, platforms, genres, playtime, ESRB), where-to-play links (Steam, IGDB, Wikipedia, HLTB, App Store), deals, Steam player reviews, similar games, community reviews.
- `HeroImage` component with next/image fallback for arbitrary domains.
- Platform icons via `PlatformIcon` component.
- Score chips showing multi-source scores (Steam, IGDB, Metacritic, RAWG).

### 11.3 Search Page (`src/app/search/page.tsx`)
- Multi-filter search: text query, platform, genre, year, monetization, sort order.
- Sort options: relevance, newest, top-rated, trending.
- Platform URL aliases (PlayStation, Xbox, Switch, Mac → internal values).
- 3-layer search: DB first → RAWG preview fallback → background ingest.
- Paginated results (12 per page).

### 11.4 Reviews Page (`src/app/reviews/page.tsx`)
- Global reviews feed across all games.
- Source tabs: Community Reviews / Steam Player Reviews.
- Filters: sort (newest/helpful), platform.
- Staff picks section replaced with dynamic top-rated query from DB.

### 11.5 Lists Page (`src/app/lists/page.tsx`)
- Curated editorial lists index.
- Admin seed button (triggers `/api/admin/seed-lists`).
- Grid layout, 10th orphan item centered.

### 11.6 Profile Page (`src/app/profile/[username]/page.tsx`)
- Tabs: Overview, Reviews, Lists, Library, Activity.
- Stats: library count, follower/following counts.
- Recent activity from reviews + library changes.
- `UserAvatar` component with image + initials fallback.

### 11.7 Library Page (`src/app/library/page.tsx`)
- Authenticated user's game collection.
- Status tabs: All, Wishlist, Playing, Completed, Dropped, Paused (Lucide icons).
- `LibraryStatusSelector` component for changing game status.
- Stats panel: total hours, average rating, genre breakdown.

### 11.8 Compare Page (`src/app/compare/page.tsx`)
- Side-by-side comparison of two games.
- Search dropdowns to select games.
- Comparison grid: scores, platforms, genres, release dates, playtime, prices.
- Platform icons shown for each game.

### 11.9 Release Calendar Page (`src/app/calendar/page.tsx`)
- Monthly view of upcoming game releases.
- Horizontal month navigator with drag scrolling.
- Platform filter (using `PLATFORM_FILTER_OPTIONS`).
- Merges GX Corner calendar + DB data (DB rows take priority).
- Unreleased games show "COMING SOON" instead of verdict scores.

### 11.10 Developer Hub Page (`src/app/developers/[slug]/page.tsx`)
- Developer portfolio: name, game count, average score, full game list.
- Case-insensitive match on developer name.

### 11.11 Explore Page (`src/app/explore/page.tsx`)
- 5 tabs: Most Anticipated, Best of 2025, All-Time Top 250, New Releases, Browse by Genre.
- Powered by RAWG curated list endpoints via `/api/rawg/lists`.
- Genre browser with 10 genres (Action, Adventure, RPG, Shooter, Strategy, Simulation, Puzzle, Racing, Sports, Platformer).
- Paginated results with `Pagination` component.
- Platform icons shown per game.

### 11.12 Static Pages
- **About** (`src/app/about/page.tsx`): Mission, features, data sources, team.
- **Privacy** (`src/app/privacy/page.tsx`): Privacy policy.
- **Terms** (`src/app/terms/page.tsx`): Terms of service.

### 11.13 Admin Dashboard (`src/app/admin/`)
- **Layout** (`layout.tsx`): Sidebar nav + role guard (redirects non-admins).
- **Dashboard** (`page.tsx`): Stats overview, recent activity, seed content section.
- **Games** (`games/page.tsx`): Searchable, paginated game list.
- **Game Editor** (`games/[id]/page.tsx`): Full game edit form, reingest controls (Full Pipeline / RAWG Only / IGDB Only), featured/trending toggles, audit log display.
- **Reviews** (`reviews/page.tsx`): Review moderation, create editorial reviews.
- **Users** (`admin/users/page.tsx`): User list with review/list/library counts, profile links.

---

## 12. Frontend — Components

### 12.1 Layout Components
- **`NavbarTop`** (~175 lines): Top navigation with logo, search, nav links, theme toggle, auth dropdown. Mobile drawer with Lucide icons. UserAvatar in profile trigger. Outside-click/Escape/route-change close.
- **`BottomNav`** (~100 lines): Mobile-only bottom tab bar. 5 tabs: Home, Search, Reviews, Lists, Library. `bg-background/80` for light mode support.
- **`SectionHeader`** (~45 lines): Section title with Lucide icon (accepts `ReactNode`). Optional `GradientText` for animated titles.

### 12.2 Display Components
- **`HeroCarousel`** (~280 lines): Auto-advancing hero with cinematic crossfade (opacity+scale). Desktop min-height 560/600px. Mobile `object-top`. 8-second intervals. Separate selection from trending rail.
- **`FeaturedHero`** (~109 lines): Static featured game hero with score, verdict badge, CTA button. Hero image guards.
- **`GameCard`** (~220 lines): Two variants — standard grid card and compact horizontal card. Score ring, verdict badge, platform icons, cover image with fallback.
- **`GameGrid`** (~60 lines): Animated grid layout with `FadeInSection` wrappers.
- **`HorizontalScroll`** (~60 lines): Mouse-only drag (touch = native scroll). Momentum-based velocity tracking. No `setPointerCapture`.
- **`MediaCarousel`** (~110 lines): Screenshot/trailer gallery with thumbnails. Lightbox mode.
- **`ReviewCard`** (~125 lines): Review display with score, author, platform icons, vote buttons.
- **`ReviewForm`**: Submit review form with rating slider, title, body, pros/cons, platform selector.
- **`ScoreChips`** (~100 lines): Multi-source score badges showing Steam %, IGDB rating, Metacritic, RAWG rating.
- **`SteamReviews`** (127 lines): Steam player reviews section. Fetches via `getSteamReviews()`. Shows up to 3 reviews with thumbs up/down, playtime, helpful count, date. Links to Steam store page.
- **`CommentThread`**: Nested comment display for review comments.
- **`AuthModal`**: Login/signup modal with OAuth providers.
- **`LibraryStatusSelector`**: Dropdown to change game status in library. Lucide icons for each status.
- **`UserAvatar`** (53 lines): Avatar component with 5 sizes (xs/sm/md/lg/xl). Uses next/image with error fallback to initials. Accent-colored initial circle.
- **`LazySection`** (50 lines): IntersectionObserver-based lazy loading. 200px rootMargin for pre-loading. Custom fallback or animated pulse placeholder.
- **`FadeInSection`** (~40 lines): Scroll-triggered fade-in animation wrapper.

### 12.3 UI Primitives
- **`FilterChips`** (~50 lines): Radio chip selector with optional icon function. Horizontally scrollable on mobile.
- **`PixelBadge`** (~40 lines): Label badge with color variants.
- **`PixelButton`** (~50 lines): Styled button with hover effects.
- **`PixelCard`** (~40 lines): Card container with border and shadow.
- **`ScoreRing`** (~60 lines): SVG circular score indicator with animated stroke. Color-coded by score range.
- **`Skeleton`** (~80 lines): Loading skeleton variants (card, text, hero, horizontal scroll).
- **`SortDropdown`** (~35 lines): Styled select dropdown for sort options.
- **`Tabs`** (~60 lines): Tab navigation with animated underline indicator.
- **`VerdictBadge`** (~35 lines): Verdict label badge (MUST PLAY, WORTH IT, MIXED, SKIP, COMING SOON). Color-coded.
- **`GradientText`** (57 lines): Animated gradient text using framer-motion. Configurable gradient, optional neon blur glow effect. `backgroundPositionX` animation for flowing gradient.
- **`HeroImage`** (52 lines): Resilient hero image component. Uses next/image with `fill` for optimized loading. Falls back to raw `<img>` tag if next/image fails (unknown domains). Lets admins set arbitrary header image URLs.
- **`PlatformIcon`** (145 lines): SVG platform icons for all 11 platforms (PC, macOS, Linux, PS5, PS4, Xbox Series, Xbox One, Switch, Switch 2, Android, iOS). Exports: `PLATFORM_COLOR_MAP`, `PLATFORM_FILTER_OPTIONS` (family-grouped: PS4+PS5→PlayStation, etc.), `getFilterPlatforms()`, `getPlatformIcon()`, `platformFilterIcon()`.
- **`Pagination`** (202 lines): Smart pagination with page numbers, ellipsis, prev/next, first/last, "Go to page" input. Responsive design. `buildPageNumbers()` algorithm shows window around current page.

### 12.4 GX Corner Components
- **`GXDealCard`** (89 lines): Deal card showing discount %, store name, prices.
- **`GXNewsCard`**: Gaming news article card with image, title, source.
- **`GXServiceBadge`**: PS Plus / Game Pass subscription badge.

---

## 13. Design System

### 13.1 Color Tokens (`src/app/globals.css`)

**Dark Mode (default)**:
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0a0a0f` | Page background |
| `--foreground` | `#f0f0f5` | Primary text |
| `--surface` | `#12121a` | Card backgrounds |
| `--surface-2` | `#1a1a24` | Elevated surfaces |
| `--accent` | `#6366f1` | Primary accent (indigo) |
| `--accent-hover` | `#818cf8` | Accent hover state |
| `--border` | `rgba(255,255,255,0.08)` | Borders |
| `--secondary` | `#a1a1aa` | Secondary text |
| `--tertiary` | `#71717a` | Muted text |

**Light Mode** (`.light` class):
- Background: `#f8f8fc`, Surface: `#ffffff`, Foreground: `#18181b`
- Accent remains indigo `#6366f1`
- Borders: `rgba(0,0,0,0.08)`

**Score Colors**:
| Token | Value | Range |
|-------|-------|-------|
| `--vg-score-great` | `#22c55e` | ≥ 90 |
| `--vg-score-good` | `#84cc16` | ≥ 75 |
| `--vg-score-mixed` | `#eab308` | ≥ 50 |
| `--vg-score-bad` | `#ef4444` | < 50 |

**Pixel Colors** (brand accents):
- `--pixel-cyan`: `#22d3ee`
- `--pixel-green`: `#4ade80`
- `--pixel-orange`: `#fb923c`

### 13.2 Typography
- **Primary font**: `var(--font-geist-sans)` (Geist Sans from `next/font/google`)
- **Mono font**: `var(--font-geist-mono)` (Geist Mono)
- Heading sizes: `text-2xl` (mobile) → `text-4xl` (desktop)
- Body text: `text-sm` with `leading-relaxed`

### 13.3 Animations & Transitions
- `animate-fade-in`: opacity 0→1 over 400ms
- `animate-slide-up`: translateY(16px)→0 + fade over 400ms
- `animate-pulse-slow`: slow pulse (2s cycle)
- `hover-lift`: translateY(-2px/-3px) on hover with fast transition
- `scoreGlowBorder`: animated gradient border on score rings (reduced intensity)
- `mesh-gradient`: animated background gradient (halved opacity)
- `hero-spotlight`: radial gradient background effect (halved opacity)
- Hero carousel: cinematic crossfade with opacity + scale transitions

### 13.4 Visual Effects
- `scrollbar-hide`: hides scrollbars on horizontal scroll containers
- Glass morphism: `backdrop-blur` on nav, bottom bar
- Score glow: colored box-shadow on score rings (50% reduced intensity)
- Gradient text: animated `backgroundPositionX` on section headers

---

## 14. State Management & Data Fetching

### React Query (TanStack Query v5)
- **Provider**: `src/app/providers.tsx` — wraps app in `QueryClientProvider`
- **Default config**: `staleTime: 5 * 60 * 1000` (5 min), `gcTime: 10 * 60 * 1000` (10 min)
- **Key patterns**: `["game", slug]`, `["steam-reviews", slug]`, `["search", params]`, `["homepage"]`, `["admin-games"]`, etc.

### Caching Strategy
| Data | staleTime | Revalidation |
|------|-----------|-------------|
| Homepage | 5 min | ISR (60s server) + client refetch |
| Game detail | 5 min | On-demand |
| Steam reviews | 30 min | Client-side |
| Search results | 0 (always fresh) | On query change |
| Admin data | 5s | `refetchOnMount: "always"` |
| GX Corner feeds | 5 min | ISR (300s server) |

### Cache Invalidation
- Admin game save/reingest/flag mutations invalidate: `admin-activity`, `admin-games`, `homepage`, `["game", slug]`
- Library mutations invalidate: `library`, `library-stats`
- Review submit invalidates: `["game-reviews", gameId]`, `reviews`

---

## 15. Theming (Dark / Light Mode)

**File**: `src/hooks/useTheme.tsx`

- `ThemeProvider` context provides `theme` and `toggleTheme`
- Persists to `localStorage` key `"theme"`
- Applies `.light` or `.dark` class to `<html>` element
- Default: dark mode
- `ThemeToggle` component: Lucide Sun/Moon icons
- All components use CSS custom properties (tokens) that switch between dark/light values

---

## 16. Client-Side API Layer

**File**: `src/lib/api.ts` (~260 lines)

Typed wrapper functions for all API endpoints. All functions use `fetch()` with JSON parsing.

**Key exports**:
- `getHomepage()` → homepage sections
- `getGame(slug)` → single game
- `searchGames(params)` → search results
- `getSteamReviews(slug, limit)` → Steam reviews
- `getReviews(params)` → global reviews feed
- `submitReview(data)` → POST review
- `getLists()` / `getList(slug)` → curated lists
- `getProfile(username)` → user profile
- `getLibrary(status)` / `updateLibrary(data)` / `removeFromLibrary(gameId)` → library CRUD
- `getLibraryStats()` → library analytics
- `followUser(targetId)` / `unfollowUser(targetId)` → social
- `getCalendar(month)` → release calendar
- `compareGames(slug1, slug2)` → comparison
- `getDeveloper(slug)` → developer hub
- `getRawgList(type, page, genre)` → RAWG curated lists
- `getRecommendations(limit)` → personalized recommendations

**Type exports**: `SteamPlayerReview`, `RawgListGameItem`, `RawgListType`

---

## 17. TypeScript Types

**File**: `src/lib/types.ts` (~160 lines)

### Core Interfaces
- **`Game`**: id, slug, title, description, coverImage, headerImage, screenshotUrls, trailerUrl, developer, publisher, releaseDate, platforms[], genres[], tags[], score, verdictLabel, verdictSummary, pros[], cons[], reviewCount, steamUrl, igdbUrl, cheapSharkUrl, wikipediaUrl, howLongToBeatUrl, appStoreUrl, steamRatingLabel, currentPlayers, playtimeMain, playtimeComplete, deals[], trending, featured, isProvisional, monetizationType, esrbRating, confidence, communityScore, criticScore, verdictScore, trendingReason, scoreSource
- **`Platform`**: Union type — `"PC"` | `"PlayStation 5"` | `"PlayStation 4"` | `"Xbox Series X|S"` | `"Xbox One"` | `"Nintendo Switch"` | `"Nintendo Switch 2"` | `"macOS"` | `"Linux"` | `"Android"` | `"iOS"`
- **`MonetizationType`**: `"Free"` | `"Paid"` | `"Free with IAP"` | `"Subscription"` | `"Unknown"`
- **`Review`**: id, gameId, profileId, rating, title, bodyText, pros, cons, platform, helpful, createdAt, authorName, authorAvatar, gameName, gameCover, gameSlug
- **`UserProfile`**: id, username, displayName, avatarUrl, bio, favoriteGenres, role, createdAt
- **`LibraryEntry`**: game + status, personalRating, hoursPlayed, notes, startedAt, completedAt
- **`Deal`**: store, price, retailPrice, savings, url

---

## 18. Utility Functions

### `src/lib/utils.ts` (~70 lines)
- `cn(...classes)` — Tailwind class merge (clsx + tailwind-merge)
- `formatNumber(n)` — Compact number formatting (1.2K, 1.5M)
- `formatDate(date)` — Human-readable date string
- `platformShort(platform)` — Short platform label ("PS5", "XSX", "NSW")
- `scoreToVerdict(score)` — Legacy score → verdict label mapping (re-exports from `utils/score.ts`)

### `src/lib/utils/score.ts` (~18 lines)
- `scoreToVerdict(score)` — Server-safe score → verdict label mapping (no DOM dependencies)
- Used by both client and server code

### `src/lib/utils/slugify.ts` (~30 lines)
- `slugify(title)` — Converts title to URL-safe slug
- `normalizeTitle(title)` — Normalizes title for comparison (lowercase, remove special chars)

### `src/lib/utils/scoring.ts`
- Full v2 scoring engine — see Section 22 (Scoring Algorithm) for details
- Exports: `wilsonLowerBound()`, `computeCommunityScore()`, `computeCriticScore()`, `computeConfidence()`, `computeVerdictScore()`, `getVerdictLabel()`

### `src/lib/utils/quality.ts`
- `isQualityGame(tier)` — Filters by review count: `"topRated"` = 50+, `"recommended"` = 20+
- `confidenceWeightedScore(game)` — Uses `verdict_score` if available, else Bayesian-smoothed legacy score
- Used by: recommendations API, homepage, seed-lists

### `src/lib/utils/platform.ts`
- `normalizePlatform(raw)` — Normalizes raw platform strings to canonical `Platform` values
- `normalizePlatforms(rawList)` — Batch normalize + deduplicate
- Maps: "pc" → "PC", "playstation5" → "PlayStation 5", "xbox-series-x" → "Xbox Series X|S", etc.
- Used as safety net in `mapGameRow()` mapper

### `src/lib/api/response.ts` (~25 lines)
- `jsonOk(data, status?, options?)` — Standard JSON success response with optional cache headers
- `jsonError(message, status)` — Standard JSON error response

### `src/lib/db/mappers.ts` (~120 lines)
- `mapGameRow(row)` — Maps Supabase `games` row to frontend `Game` interface
- Applies: verdict score display, Bayesian smoothing fallback, future game forcing (COMING SOON), `regenerateVerdictSummary()`, `sanitizePros()`, `normalizePlatforms()`
- `mapReviewRow(row)` — Maps review DB row to `Review` interface

---

## 19. Scripts

### Ingestion Scripts
- **`scripts/ingest-full-library.mjs`** (~300 lines): Bulk game ingestion from RAWG. Supports `--page`, `--limit`, `--genre` flags. Rate-limited with 200ms delay between calls.
- **`scripts/refresh-games.mjs`** (~30 lines): Re-ingest specific games by slug/title.
- **`scripts/refresh-all-games.mjs`** (~50 lines): Re-ingest all games in DB with rate limiting.
- **`scripts/reingest-critical.mjs`**: Re-ingests high-priority games (e.g., AAA titles with stale data).
- **`scripts/backfill-games.mjs`**: Backfills missing fields on existing games.

### Seeding Scripts
- **`scripts/seed-flags.mjs`** (~40 lines): Sets trending/featured flags on specific games.
- **`scripts/seed-curated-lists.mjs`**: Seeds editorial curated lists locally (standalone version of admin seed-lists API).

### Migration Scripts
- **`scripts/apply-schema.mjs`** (~20 lines): Applies `supabase/schema.sql` to database.
- **`scripts/apply-migration-001.mjs`** (~20 lines): Multi-source columns migration.
- **`scripts/apply-migration-003.mjs`** (~80 lines): User features migration (auth, library, follows, comments, votes).
- **`scripts/apply-migration-005.mjs`** (~60 lines): Admin override columns migration.
- **`scripts/apply-migration-011.mjs`**: Applies migration 011.
- **`scripts/apply-migration-012.mjs`**: Applies migration 012.
- **`scripts/migrate-score-columns.mjs`** (~40 lines): Adds per-source score columns and re-enriches.
- **`scripts/migrate-players-updated-at.mjs`** (~20 lines): Adds `players_updated_at` column.
- **`scripts/migrate-refresh-lock.mjs`**: Adds `refresh_lock_until` column for concurrent refresh prevention.

### Heroku Scheduler Scripts
- **`scripts/heroku-discover-games.mjs`** (~20 lines): Calls `/api/cron/discover` on Vercel deployment URL.
- **`scripts/heroku-refresh-trending.mjs`** (~20 lines): Calls `/api/cron/refresh-trending` on Vercel deployment URL.
- **`scripts/heroku-re-enrich.mjs`**: Calls `/api/cron/re-enrich` on Vercel deployment URL.

### Utility Scripts
- **`scripts/update-igdb-images.mjs`**: Updates IGDB cover/screenshot images for existing games.
- **`scripts/backfill-mobile-listings.mjs`**: Batch verifies mobile store listings (Google Play + App Store). Flags: `--android-only`, `--ios-only`, `--limit=N`, `--dry-run`.
- **`scripts/generate-icons.mjs`**: Generates PWA icon variants from source image.
- **`scripts/verify-db.mjs`**: Verifies database connectivity and table existence.

### Script Library
- **`scripts/lib/db-connect.mjs`**: Shared Supabase client for scripts (reads env vars).
- **`scripts/lib/scheduler-logger.mjs`**: Logging utility for Heroku scheduler scripts.

### Admin Override Scripts
- `scripts/migrate-admin-overrides.mjs`: Adds `is_featured_manual`, `is_trending_manual`, `manual_score` columns to `games`.

---

## 20. SEO & Metadata

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

## 21. Deployment

### Architecture
- **Frontend + API Routes**: Deployed on **Vercel** (primary hosting)
- **Cron Scheduler**: Runs on **Heroku** for periodic game discovery and trending refresh
- Both share the same codebase and Supabase database

### Vercel (Frontend + API)
1. Push to GitHub
2. Import into Vercel
3. Add environment variables in Vercel → Settings → Environment Variables
4. Set `NEXT_PUBLIC_SITE_URL` to production URL (e.g., `https://www.verdict.games`)
5. Deploy — `vercel.json` hints `nextjs` framework

### Heroku (Cron Scheduler + Backup Hosting)
- `Procfile`: `web: npm run start`
- `heroku-postbuild` script: `next build`
- **Heroku Scheduler** — Add-on for automated jobs:
  - `npm run scheduler:trending` — Daily trending refresh
  - `npm run scheduler:discover` — Daily/weekly game discovery (~320 games per standard run)
  - `npm run scheduler:discover -- --deep` — Weekly deep discovery (~700+ games)
- All scheduler scripts call the `/api/cron/*` endpoints on the Vercel deployment URL

### Cron Job Setup
- **Discover (Standard)**: Run `GET /api/cron/discover?secret=YOUR_SECRET` daily — fetches ~320 new games
- **Discover (Deep)**: Run `GET /api/cron/discover?secret=YOUR_SECRET&deep=true` weekly — fetches ~700+ games
- **Refresh Trending**: Run `GET /api/cron/refresh-trending?secret=YOUR_SECRET` daily
- **Re-Enrich**: Run `GET /api/cron/re-enrich?secret=YOUR_SECRET` — refreshes stale games
- Can be triggered via: Vercel Cron, Heroku Scheduler, GitHub Actions, or any external cron service

---

## 22. Security

### API Key Protection
- `SUPABASE_SERVICE_ROLE_KEY` — **Server-only**, imported only in `src/lib/supabase/server.ts`, used by Route Handlers. Never exposed to client
- `RAWG_API_KEY`, `STEAM_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` — Server-only, used in `src/lib/external/*.ts` files
- All POST ingestion routes support optional `CRON_SECRET` authentication (query param or Bearer header)

### Database Security
- Row Level Security (RLS) enabled on all tables (games, reviews, lists, list_items, profiles, user_games, follows, review_votes, review_comments, admin_audit_log, source_mappings, steam_reviews, mobile_store_listings)
- Public `SELECT` policies allow read-only access
- All write operations (`INSERT`, `UPDATE`, `DELETE`) restricted to `service_role` — only accessible via server-side code using the service role key
- The `anon` key (public) cannot write to any table

### Input Validation
- Ingestion routes validate: JSON body parsing, query string length (2–200 chars), batch size (max 50)
- Bad requests return 400 with descriptive messages
- POST routes check for required fields before processing
- Profile settings: field length limits (display_name 100, bio 1000, genres 20)
- Avatar upload: MIME type whitelist (JPEG/PNG/WebP), 2MB size limit

### Admin Access Control
- Admin routes (`/api/admin/*`) are protected by `requireAdmin()` from `src/lib/admin.ts`
- Access is controlled by a **hardcoded email list** in `src/lib/admin.ts` — only users whose Supabase Auth email matches a listed admin email can access admin endpoints
- Non-admin users receive `403 Forbidden`; unauthenticated users receive `401 Not authenticated`
- The admin dashboard UI (`/admin/*`) also enforces a client-side role guard in `src/app/admin/layout.tsx`
- All admin mutations write to `admin_audit_log` via `writeAuditLog()` helper

### Environment Checks
- All API routes check for Supabase configuration before attempting database operations
- Missing config returns empty data (graceful degradation), not crashes

---

## 23. Scoring Algorithm

**File**: `src/lib/utils/scoring.ts`

The v2 Verdict Scoring system replaced the legacy waterfall score with a multi-signal composite.

### 23.1 Community Score (Wilson Lower Bound)

```
communityScore = wilsonLowerBound(steamPositive, steamTotal) × 100
```

- Uses Wilson score interval (95% confidence) to produce a conservative lower bound of the true positive rating.
- Ensures games with few reviews are not over-rated (a game with 3/3 positive reviews does not score 100).
- Range: 0–100.

### 23.2 Critic Score

```
criticScore = average(igdbRating, rawgMetacritic)
```

- Averages available critic sources (IGDB aggregated rating, RAWG metacritic).
- If only one source is available, uses that source alone.
- Range: 0–100.

### 23.3 Confidence

```
confidence = reviewVolume × 0.4 + sourceCoverage × 0.3 + criticCoverage × 0.3
```

- **Review volume**: Scaled 0→1 based on Steam review count (0 at 0 reviews, 1 at 10,000+ reviews).
- **Source coverage**: Fraction of available data sources (Steam, IGDB, RAWG, CheapShark, Wikipedia, HLTB) that returned data.
- **Critic coverage**: Whether IGDB and/or Metacritic scores are present (0, 0.5, or 1.0).
- Range: 0–1.

### 23.4 Verdict Score

```
verdictScore = communityScore × 0.5 + criticScore × 0.3 + (confidence × 20)
```

- **Community weight**: 50% — Steam user reviews are the primary signal.
- **Critic weight**: 30% — Professional/aggregated reviews.
- **Confidence bonus**: 20% — Up to 20 points for data completeness (high confidence = more trustworthy score).
- Range: 0–100.

### 23.5 Verdict Labels

| Score Range | Label | Color |
|-------------|-------|-------|
| ≥ 90 | MUST PLAY | Green (`--vg-score-great`) |
| ≥ 75 | WORTH IT | Lime (`--vg-score-good`) |
| ≥ 50 | MIXED | Yellow (`--vg-score-mixed`) |
| < 50 | SKIP | Red (`--vg-score-bad`) |
| Provisional / Future | COMING SOON | Gray |

### 23.6 Bayesian Smoothing Fallback

For games without v2 scores (legacy data), the display score uses Bayesian smoothing:

```
displayScore = (reviewCount × rawScore + PRIOR_COUNT × PRIOR_MEAN) / (reviewCount + PRIOR_COUNT)
```

Where `PRIOR_COUNT = 50` and `PRIOR_MEAN = 65`. This pulls low-review-count games toward the mean, preventing extreme scores from small samples.

### 23.7 Verdict Summary Regeneration

`regenerateVerdictSummary()` in `src/lib/db/mappers.ts` produces the summary text from the **Bayesian-smoothed display score** at read time, not the raw ingest-time score. This fixes mismatches like "77 score but says exceptional experience".

---

## 24. Complete File Reference

| File | Lines | Type | Description |
|------|-------|------|-------------|
| **Configuration** | | | |
| `package.json` | 44 | Config | Dependencies, scripts, engines |
| `next.config.ts` | 21 | Config | Image domains whitelist |
| `tsconfig.json` | 36 | Config | TypeScript strict mode, paths |
| `eslint.config.mjs` | 19 | Config | ESLint 9 flat config |
| `postcss.config.mjs` | 8 | Config | Tailwind CSS v4 plugin |
| `vercel.json` | 17 | Config | Framework hint + Vercel Cron schedules |
| `Procfile` | 1 | Config | Heroku web process |
| **Database** | | | |
| `supabase/schema.sql` | ~210 | SQL | Full database schema |
| `supabase/migrations/001_multi_source.sql` | ~48 | SQL | Multi-source enrichment columns |
| `supabase/migrations/002_player_snapshots.sql` | ~30 | SQL | Player snapshot table + momentum |
| `supabase/migrations/003_security_lint_fixes.sql` | ~20 | SQL | Supabase linter fixes (search_path, RLS scoping) |
| `supabase/migrations/004_user_features.sql` | ~220 | SQL | Auth + library/follows/comments/votes + RLS |
| `supabase/migrations/005_admin_role.sql` | 9 | SQL | Admin role column + CHECK constraint |
| `supabase/migrations/006_admin_overrides.sql` | ~15 | SQL | Admin override columns (featured/trending/score) |
| `supabase/migrations/007_refresh_lock.sql` | — | SQL | Game refresh lock flag |
| `supabase/migrations/008_refresh_started_at.sql` | — | SQL | Refresh lock expiry timestamp |
| `supabase/migrations/009_provisional_and_audit.sql` | — | SQL | Provisional flag + admin_audit_log table |
| `supabase/migrations/010_rls_refactor.sql` | — | SQL | auth_profile_id() helper + RLS optimization |
| `supabase/migrations/011_storage_avatars.sql` | — | SQL | Avatars storage bucket + RLS |
| `supabase/migrations/012_steam_reviews_and_ingest_runs.sql` | — | SQL | Steam reviews cache + ingest_runs table |
| `supabase/migrations/013_mobile_store_listings_rls.sql` | — | SQL | Mobile store listings RLS |
| `supabase/migrations/014_comprehensive_security_fix.sql` | — | SQL | Critical RLS fix (service_role scoping) |
| `supabase/migrations/015_verdict_scoring.sql` | — | SQL | v2 scoring columns + indexes |
| **Pages** | | | |
| `src/app/layout.tsx` | 72 | Layout | Root layout with fonts, nav, analytics |
| `src/app/page.tsx` | ~740 | Page | Homepage with 11 sections (incl. 5 GX-powered) |
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
| `src/app/explore/page.tsx` | ~200 | Page | RAWG curated lists (5 tabs) |
| `src/app/reviews/page.tsx` | ~100 | Page | Global reviews feed |
| `src/app/lists/page.tsx` | ~80 | Page | Curated lists index |
| `src/app/lists/[slug]/page.tsx` | ~80 | Page | List detail |
| `src/app/profile/[username]/page.tsx` | ~150 | Page | User profile |
| `src/app/library/page.tsx` | ~200 | Page | Authenticated user library |
| `src/app/compare/page.tsx` | ~300 | Page | Game comparison (side-by-side) |
| `src/app/calendar/page.tsx` | ~170 | Page | Release calendar |
| `src/app/developers/[slug]/page.tsx` | ~115 | Page | Developer hub |
| `src/app/about/page.tsx` | ~120 | Page | About page |
| `src/app/privacy/page.tsx` | ~100 | Page | Privacy policy |
| `src/app/terms/page.tsx` | ~100 | Page | Terms of service |
| `src/app/admin/layout.tsx` | — | Layout | Admin sidebar nav + role guard |
| `src/app/settings/page.tsx` | — | Page | User settings (profile editing) |
| `src/app/admin/page.tsx` | — | Page | Admin dashboard overview |
| `src/app/admin/games/page.tsx` | — | Page | Admin game list (search + paginate) |
| `src/app/admin/games/new/page.tsx` | — | Page | Admin create new game |
| `src/app/admin/games/[id]/page.tsx` | — | Page | Admin game editor form |
| `src/app/admin/reviews/page.tsx` | — | Page | Admin review moderation |
| `src/app/admin/users/page.tsx` | — | Page | Admin user list |
| **API Routes — Auth** | | | |
| `src/app/api/auth/me/route.ts` | ~15 | API | Current authenticated user |
| `src/app/api/auth/callback/route.ts` | ~50 | API | Supabase OAuth callback |
| `src/app/api/auth/bootstrap/route.ts` | ~79 | API | Ensure profile row exists for auth user |
| **API Routes — Homepage** | | | |
| `src/app/api/homepage/route.ts` | ~30 | API | Homepage aggregator (ISR 60s) |
| **API Routes — Games** | | | |
| `src/app/api/games/trending/route.ts` | ~60 | API | Trending games endpoint |
| `src/app/api/games/new-releases/route.ts` | ~70 | API | New releases endpoint |
| `src/app/api/games/top-rated/route.ts` | ~45 | API | Top rated endpoint |
| `src/app/api/games/[slug]/route.ts` | ~45 | API | Single game endpoint |
| `src/app/api/games/[slug]/reviews/route.ts` | ~90 | API | Game reviews endpoint |
| `src/app/api/games/[slug]/deals/route.ts` | ~80 | API | Game deals endpoint |
| `src/app/api/games/[slug]/news/route.ts` | ~65 | API | Game news endpoint |
| `src/app/api/games/[slug]/achievements/route.ts` | ~65 | API | Game achievements endpoint |
| `src/app/api/games/[slug]/steam-reviews/route.ts` | ~213 | API | Steam player reviews (cached) |
| `src/app/api/games/stats/route.ts` | ~30 | API | Site-wide stats endpoint |
| **API Routes — Discovery** | | | |
| `src/app/api/search/route.ts` | ~130 | API | Search with on-demand ingest |
| `src/app/api/recommendations/route.ts` | ~110 | API | Personalized recommendations |
| `src/app/api/rawg/lists/route.ts` | ~118 | API | RAWG curated lists proxy |
| **API Routes — Social** | | | |
| `src/app/api/reviews/route.ts` | ~130 | API | Global reviews feed + submit review |
| `src/app/api/reviews/[id]/vote/route.ts` | ~45 | API | Vote on a review |
| `src/app/api/reviews/[id]/comments/route.ts` | ~100 | API | Review comments (threaded) |
| `src/app/api/lists/route.ts` | ~70 | API | All curated lists |
| `src/app/api/lists/[slug]/route.ts` | ~65 | API | Single list |
| `src/app/api/profile/[username]/route.ts` | ~60 | API | User profile |
| `src/app/api/profile/settings/route.ts` | ~142 | API | Profile settings + avatar upload |
| `src/app/api/library/route.ts` | ~120 | API | User library (CRUD) |
| `src/app/api/library/stats/route.ts` | ~60 | API | Library stats |
| `src/app/api/follow/route.ts` | ~50 | API | Follow/unfollow user |
| **API Routes — Misc** | | | |
| `src/app/api/calendar/route.ts` | ~60 | API | Release calendar |
| `src/app/api/compare/route.ts` | ~50 | API | Compare two games |
| `src/app/api/developers/[slug]/route.ts` | ~60 | API | Developer hub API |
| **API Routes — Ingestion** | | | |
| `src/app/api/ingest/game/route.ts` | ~75 | API | Single game ingestion |
| `src/app/api/ingest/batch/route.ts` | ~75 | API | Batch game ingestion |
| **API Routes — Cron** | | | |
| `src/app/api/cron/discover/route.ts` | ~150 | API | Auto-discover games |
| `src/app/api/cron/refresh-trending/route.ts` | ~213 | API | Refresh trending/featured (+ GX signal) |
| `src/app/api/cron/re-enrich/route.ts` | ~178 | API | Re-enrich stale game data |
| **API Routes — GX Corner** | | | |
| `src/app/api/gx/highlights/route.ts` | — | API | GX hero highlights proxy |
| `src/app/api/gx/calendar/route.ts` | — | API | GX release calendar proxy |
| `src/app/api/gx/free-to-play/route.ts` | — | API | GX free-to-play proxy |
| `src/app/api/gx/top-games/route.ts` | — | API | GX PS Plus/Game Pass proxy |
| `src/app/api/gx/deals/route.ts` | — | API | GX super deals proxy |
| `src/app/api/gx/top-liked/route.ts` | — | API | GX most liked proxy |
| `src/app/api/gx/news/popular/route.ts` | — | API | GX trending news proxy |
| `src/app/api/gx/news/feed/route.ts` | — | API | GX full news feed proxy |
| **API Routes — Admin** | | | |
| `src/app/api/admin/stats/route.ts` | — | API | Admin dashboard stats |
| `src/app/api/admin/games/route.ts` | — | API | Admin game list |
| `src/app/api/admin/games/[id]/route.ts` | — | API | Admin game view/edit |
| `src/app/api/admin/games/[id]/ingest/route.ts` | — | API | Admin force re-ingest |
| `src/app/api/admin/games/[id]/delete/route.ts` | ~63 | API | Admin delete game + cascade |
| `src/app/api/admin/reviews/route.ts` | — | API | Admin review CRUD |
| `src/app/api/admin/featured/route.ts` | — | API | Admin toggle featured/trending |
| `src/app/api/admin/audit/route.ts` | ~28 | API | Admin audit log viewer |
| `src/app/api/admin/users/route.ts` | ~62 | API | Admin user list with counts |
| `src/app/api/admin/backfill-scores/route.ts` | ~196 | API | Recompute v2 scores for all games |
| `src/app/api/admin/seed-lists/route.ts` | ~237 | API | Seed editorial curated lists |
| **Components** | | | |
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
| `src/components/UserAvatar.tsx` | 53 | Component | Avatar with image + initials fallback |
| `src/components/SteamReviews.tsx` | 127 | Component | Steam player reviews section |
| `src/components/LazySection.tsx` | 50 | Component | IntersectionObserver lazy loader |
| `src/components/AuthModal.tsx` | — | Component | Login/signup modal with OAuth providers |
| `src/components/CommentThread.tsx` | — | Component | Threaded review comments UI |
| `src/components/LibraryStatusSelector.tsx` | — | Component | Library status picker with Lucide icons |
| `src/components/ReviewForm.tsx` | — | Component | Review submission form |
| `src/components/GXDealCard.tsx` | 89 | Component | GX deal card |
| `src/components/GXNewsCard.tsx` | — | Component | GX news article card |
| `src/components/GXServiceBadge.tsx` | — | Component | PS Plus / Game Pass badge |
| **UI Primitives** | | | |
| `src/components/ui/FilterChips.tsx` | ~50 | UI | Radio chip selector |
| `src/components/ui/PixelBadge.tsx` | ~40 | UI | Label badge |
| `src/components/ui/PixelButton.tsx` | ~50 | UI | Styled button |
| `src/components/ui/PixelCard.tsx` | ~40 | UI | Card container |
| `src/components/ui/ScoreRing.tsx` | ~60 | UI | SVG score ring |
| `src/components/ui/Skeleton.tsx` | ~80 | UI | Loading skeletons |
| `src/components/ui/SortDropdown.tsx` | ~35 | UI | Styled select |
| `src/components/ui/Tabs.tsx` | ~60 | UI | Tab navigation |
| `src/components/ui/VerdictBadge.tsx` | ~35 | UI | Verdict label badge |
| `src/components/ui/GradientText.tsx` | 57 | UI | Animated gradient text (framer-motion) |
| `src/components/ui/HeroImage.tsx` | 52 | UI | Resilient hero image with fallback |
| `src/components/ui/PlatformIcon.tsx` | 145 | UI | SVG platform icons (11 platforms) |
| `src/components/ui/Pagination.tsx` | 202 | UI | Smart pagination with Go-to-page |
| **Hooks** | | | |
| `src/hooks/useTheme.tsx` | ~55 | Hook | Theme context + toggle |
| `src/hooks/useAuth.tsx` | — | Hook | Auth context/provider (Supabase Auth) |
| **Library** | | | |
| `src/lib/admin.ts` | 36 | Auth | Admin access control (requireAdmin guard) |
| `src/lib/adminEmails.ts` | — | Auth | Admin email list |
| `src/lib/auditLog.ts` | 35 | Service | Admin audit log writer |
| `src/lib/api.ts` | ~260 | Client | Frontend API wrapper |
| `src/lib/types.ts` | ~160 | Types | All frontend interfaces |
| `src/lib/utils.ts` | ~70 | Utility | UI helpers (cn, formatNumber, formatDate) |
| `src/lib/api/response.ts` | ~25 | Utility | JSON response helpers |
| `src/lib/db/mappers.ts` | ~120 | Mapper | DB → frontend model |
| `src/lib/utils/score.ts` | ~18 | Utility | Server-safe score mapping |
| `src/lib/utils/slugify.ts` | ~30 | Utility | URL slug + title normalization |
| `src/lib/utils/scoring.ts` | — | Utility | v2 scoring engine (Wilson LB, confidence) |
| `src/lib/utils/quality.ts` | — | Utility | Quality gates + confidence-weighted score |
| `src/lib/utils/platform.ts` | — | Utility | Platform normalization |
| **External API Clients** | | | |
| `src/lib/external/rawg.ts` | ~230 | External | RAWG API client |
| `src/lib/external/steam.ts` | ~310 | External | Steam API client |
| `src/lib/external/igdb.ts` | ~460 | External | IGDB/Twitch API client |
| `src/lib/external/cheapshark.ts` | ~275 | External | CheapShark API client |
| `src/lib/external/wikipedia.ts` | ~120 | External | Wikipedia API client |
| `src/lib/external/gxcorner.ts` | 286 | External | GX Corner API client (8 feeds) |
| `src/lib/external/howlongtobeat.ts` | — | External | HowLongToBeat API client |
| `src/lib/external/googleplay.ts` | — | External | Google Play Store scraper |
| `src/lib/external/appstore.ts` | — | External | Apple App Store (iTunes) API client |
| **Services** | | | |
| `src/lib/services/ingest.ts` | ~575 | Service | Multi-source ingestion pipeline |
| `src/lib/services/homepage.ts` | — | Service | Homepage data aggregator |
| `src/lib/services/igdbBootstrap.ts` | — | Service | IGDB token bootstrap (Twitch OAuth) |
| **Supabase** | | | |
| `src/lib/supabase/auth.ts` | — | Auth | Server-side auth helpers (getCurrentUser) |
| `src/lib/supabase/client.ts` | ~30 | DB | Browser Supabase client |
| `src/lib/supabase/server.ts` | ~33 | DB | Server Supabase client |
| `src/lib/supabase/index.ts` | ~8 | DB | Barrel export |
| `src/lib/supabase/types.ts` | ~180 | DB | Database type definitions |
| **Scripts** | | | |
| `scripts/ingest-full-library.mjs` | ~300 | Script | Bulk game ingestion |
| `scripts/seed-flags.mjs` | ~40 | Script | Set trending/featured flags |
| `scripts/seed-curated-lists.mjs` | — | Script | Seed editorial curated lists |
| `scripts/refresh-games.mjs` | ~30 | Script | Re-ingest specific games |
| `scripts/refresh-all-games.mjs` | ~50 | Script | Re-ingest all games |
| `scripts/reingest-critical.mjs` | — | Script | Re-ingest high-priority games |
| `scripts/backfill-games.mjs` | — | Script | Backfill missing game fields |
| `scripts/backfill-mobile-listings.mjs` | — | Script | Verify mobile store listings |
| `scripts/update-igdb-images.mjs` | — | Script | Update IGDB images for existing games |
| `scripts/heroku-discover-games.mjs` | ~20 | Script | Heroku cron: discover |
| `scripts/heroku-refresh-trending.mjs` | ~20 | Script | Heroku cron: trending |
| `scripts/heroku-re-enrich.mjs` | — | Script | Heroku cron: re-enrich |
| `scripts/apply-schema.mjs` | ~20 | Script | Apply SQL schema |
| `scripts/apply-migration-001.mjs` | ~20 | Script | Apply migration 001 |
| `scripts/apply-migration-003.mjs` | ~80 | Script | Apply migration 003 (user features) |
| `scripts/apply-migration-005.mjs` | ~60 | Script | Apply migration 005 (admin overrides) |
| `scripts/apply-migration-011.mjs` | — | Script | Apply migration 011 |
| `scripts/apply-migration-012.mjs` | — | Script | Apply migration 012 |
| `scripts/migrate-score-columns.mjs` | ~40 | Script | Add score columns |
| `scripts/migrate-players-updated-at.mjs` | ~20 | Script | Add players_updated_at |
| `scripts/migrate-refresh-lock.mjs` | — | Script | Add refresh_lock_until column |
| `scripts/generate-icons.mjs` | — | Script | Generate PWA icon variants |
| `scripts/verify-db.mjs` | — | Script | Verify DB connectivity |
| `scripts/lib/db-connect.mjs` | — | Lib | Shared Supabase client for scripts |
| `scripts/lib/scheduler-logger.mjs` | — | Lib | Heroku scheduler logger |

---

## 25. Recent Changes Log

### UI Overhaul (March 2026)

**Homepage:**
- Increased all sections to 20 games each (trending, top rated, new releases, recommendations, deals, free-to-play)
- Created `GradientText` component with animated gradient text using framer-motion
- Each section header has a unique animated gradient
- Reorganized homepage into: Hero → Trending → For You → Discover (tabbed) → Top Rated → News → Footer
- Added `HorizontalScrollSkeleton` matching actual card layout

**HorizontalScroll Component:**
- Complete rewrite: mouse-only drag (touch uses native smooth scrolling)
- Removed `setPointerCapture` which was blocking desktop clicks on game cards
- Momentum-based scrolling with velocity tracking
- Removed drag zone div below cards

**Hero Carousel:**
- Desktop min-height increased to 560px/600px (md/lg)
- Mobile image uses `object-top` instead of `object-center` to fix zoom
- Cinematic crossfade transitions (opacity+scale)

**Calendar Page:**
- Bigger game cards (w-14 h-[74px] sm:w-[72px] sm:h-24)
- Month click after drag fixed (hasDragged reset in pointerUp)
- Current month indicator uses ring-2 ring-background (not clipped)
- Unreleased games no longer show verdict scores
- Merged GX + DB calendar data (DB rows take priority)

**Reviews Page:**
- Bigger game image in Steam review header (w-16 h-20)
- Added link to verdict.games game page
- Source tabs: Community Reviews / Steam Player Reviews
- Platform filter scrollbar hidden

**Lists Page:**
- 10th orphan item centered in grid
- Seed script avoids duplicate cover images across lists

**Search Page:**
- Platform filter scrollbar hidden
- Relevance sort fixed: sorts by score desc (then release_date) instead of being identical to newest

**Navigation:**
- Mobile sidebar: Explore and Trending no longer both highlighted on `/search?sort=trending`
- Mobile sidebar uses proper URL+query matching for active state

**Skeleton Loading (all pages):**
- All loading skeletons updated to match actual page layouts
- Homepage: horizontal card rows instead of grids
- Calendar: month nav + platform filters + day groups
- Reviews: source tabs + filter row
- Game detail: hero banner + title bar + content grid
- Search: filter sections at correct max-width

### Admin Dashboard Improvements

**Reingest System:**
- Source selection dropdown: Full Pipeline / RAWG Only / IGDB Only
- IGDB reingest now does full `getIgdbGame()` call after search match to get all expanded fields
- IGDB reingest applies: cover image, screenshots, header image, trailer, description, ratings, URLs directly to database
- RAWG reingest applies: cover, platforms, genres, release date, description, developer, publisher, screenshots
- Success message shows which specific fields were updated

**Audit Log:**
- Created `admin_audit_log` table in Supabase with UUID PK, JSONB field_changes, RLS policy, indexes
- Dashboard shows expandable audit entries with old→new field change diffs
- Color-coded values (red strikethrough for old, green for new)
- Empty→empty changes filtered out
- Shared `writeAuditLog` helper used across all admin routes

**Auth Guard:**
- Fixed admin page redirect on refresh: 500ms timer with split effects for denied/auth state
- Separate effect handles user becoming available after initial check

### Data & Backend

- `extractIgdbEnrichment` now returns `coverImageUrl` and `screenshotUrls` from IGDB
- `findIgdbMatch` query expanded to include `screenshots.image_id`
- Homepage recency filters: trending 18mo, top rated 24mo (fallback 36mo), recommendations 36mo
- `igdbImageUrl()` helper for building IGDB image URLs with size variants
- IGDB PopScore trending: weighted composite (visits 25%, want-to-play 30%, playing 30%, Steam peak 15%)

### Security

- `.mcp.json` removed from git tracking and added to `.gitignore` (contained API keys)
- Admin audit log records all game edits with field-level diffs

---

*This documentation covers every file, function, component, database table, API route, external integration, design token, animation, and configuration in the verdict.games codebase. Last updated: March 2026.*
