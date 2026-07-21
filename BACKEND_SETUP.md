# verdict.games — Backend Setup Guide

Complete guide for setting up the Supabase database, configuring API keys, running the ingestion pipeline, and deploying to Vercel + GitHub Actions.

---

## Prerequisites

- **Node.js 20.9+** and **npm 9+**
- A [Supabase](https://supabase.com) project (free tier works)
- A [RAWG](https://rawg.io/apidocs) API key (free, 20K requests/month)
- (Optional) [Twitch/IGDB credentials](https://dev.twitch.tv/console) (free, 4 req/sec) — enriches games with IGDB ratings, trailers, screenshots
- (Optional) [Steam Web API key](https://steamcommunity.com/dev/apikey) — enriches games with player counts, review stats, pricing

---

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your credentials from **Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role (secret) key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Run Database Migrations

### Option A: SQL Editor (recommended)

1. Open **Supabase Dashboard → SQL Editor**
2. Run every SQL file in `supabase/migrations` in lexical order, starting with `000_initial_schema.sql`
3. Treat `supabase/schema.sql` as a derived reference snapshot, not the bootstrap source of truth

### Option B: Script-based

```bash
node scripts/apply-schema.mjs
```

---

## 3. Set Environment Variables

```bash
cp .env.example .env.local
```

### Required

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**keep secret!**) |
| `RAWG_API_KEY` | https://rawg.io/apidocs |

### Optional (recommended for full enrichment)

| Variable | Where to get it | What it enables |
|----------|----------------|-----------------|
| `TWITCH_CLIENT_ID` | https://dev.twitch.tv/console | IGDB ratings, trailers, screenshots |
| `TWITCH_CLIENT_SECRET` | https://dev.twitch.tv/console | IGDB authentication |
| `STEAM_API_KEY` | https://steamcommunity.com/dev/apikey | Steam reviews, player counts, pricing |
| `CRON_SECRET` | Any random string | Protects cron endpoints from unauthorized calls (required when using them) |
| `NEXT_PUBLIC_SITE_URL` | Your deployment URL | SEO, sitemap, OG images |
| `SUPABASE_AVATAR_BUCKET` | Default: `avatars` | Storage bucket for user avatar uploads |
| `ADMIN_EMAILS` | Comma-separated emails | Admin access control (parsed by `src/lib/adminEmails.ts`) |
| `SUPABASE_DB_URL` | Supabase → Settings → Database | Direct or pooler Postgres URI for scheduler scripts |
| `SOURCE_DATE_EPOCH` | Unix timestamp of last deploy | Reproducible sitemap `lastmod` dates |
| `VERDICT_SITEMAP_LASTMOD` | ISO date string | Explicit sitemap last-modified override |

---

## 4. Install & Run

```bash
npm install
npm run dev
```

The app starts at `http://localhost:3000`.

**Without Supabase configured**, all API routes return empty arrays gracefully — the frontend renders but shows no data.

---

## 5. Seed Initial Data

### Ingest games

```bash
# Ingest ~300 curated games from RAWG (takes ~10 min)
node scripts/ingest-full-library.mjs

# Set trending/featured flags
node scripts/seed-flags.mjs

# Create 22 system-curated editorial lists
node scripts/seed-curated-lists.mjs
```

### Test single ingestion

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
    "gameId": "uuid-here",
    "slug": "hades",
    "message": "Game \"Hades\" ingested successfully.",
    "alreadyExisted": false
  }
}
```

Visit `http://localhost:3000/game/hades` to see the result.

### Batch ingestion

```bash
curl -X POST http://localhost:3000/api/ingest/batch \
  -H "Content-Type: application/json" \
  -d '{"queries": ["Hades", "Elden Ring", "Stardew Valley", "Hollow Knight"]}'
```

### Backfill v2 scores (after initial ingestion)

```bash
# From browser console (must be logged in as admin):
fetch('/api/admin/backfill-scores', { method: 'POST' }).then(r => r.json()).then(console.log)
```

### Verify mobile store listings (optional)

```bash
node scripts/backfill-mobile-listings.mjs --limit=50 --dry-run  # preview
node scripts/backfill-mobile-listings.mjs                        # full run
node scripts/backfill-mobile-listings.mjs --android-only         # Android only
node scripts/backfill-mobile-listings.mjs --ios-only             # iOS only
```

---

## 6. API Routes Reference

### Public Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/homepage` | Homepage aggregator (all sections in one call, ISR 60s) |
| GET | `/api/games/trending` | Trending games |
| GET | `/api/games/new-releases` | Newest releases |
| GET | `/api/games/top-rated` | Highest-scored games |
| GET | `/api/games/stats` | Site-wide statistics |
| GET | `/api/games/[slug]` | Single game detail |
| GET | `/api/games/[slug]/reviews` | Reviews for a game |
| GET | `/api/games/[slug]/deals` | Price deals |
| GET | `/api/games/[slug]/news` | Latest Steam news/patch notes |
| GET | `/api/games/[slug]/achievements` | Steam achievement stats |
| GET | `/api/games/[slug]/steam-reviews` | Steam player reviews (cached 24h) |
| GET | `/api/games/[slug]/editorial` | Editorial reviews for a game |
| GET | `/api/games/[slug]/related` | Related games (genre/tag/dev scoring) |
| GET | `/api/games/[slug]/system-requirements` | PC system requirements from Steam |
| GET | `/api/search?q=&platform=&genre=&sort=&page=` | Search with filters |
| GET | `/api/recommendations?limit=` | Personalized recommendations |
| GET | `/api/rawg/lists?type=&page=&genre=` | RAWG curated lists proxy |
| GET | `/api/calendar?month=YYYY-MM` | Release calendar |
| GET | `/api/compare?slugs=slug1,slug2` | Side-by-side game comparison |
| GET | `/api/developers/[slug]` | Developer hub |
| GET | `/api/reviews?sort=&platform=&page=` | Global review feed |
| POST | `/api/reviews` | Submit a review (auth required) |
| GET | `/api/reviews/[id]/comments` | Review comments |
| POST | `/api/reviews/[id]/comments` | Add a comment (auth required) |
| POST | `/api/reviews/[id]/vote` | Vote on a review (auth required) |
| GET | `/api/lists` | All curated lists |
| GET | `/api/lists/[slug]` | Single list with games |
| GET | `/api/profile/[username]` | User profile |
| GET | `/api/profile/[username]/reviews` | User's reviews |
| PATCH | `/api/profile/settings` | Update profile fields (auth required) |
| POST | `/api/profile/settings` | Upload avatar (auth required, multipart) |
| GET | `/api/library` | User library (auth required) |
| POST | `/api/library` | Add/update library entry (auth required) |
| DELETE | `/api/library?gameId=` | Remove from library (auth required) |
| GET | `/api/library/stats` | Library statistics (auth required) |
| POST | `/api/follow` | Follow/unfollow user (auth required) |

### Auth Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/auth/me` | Current authenticated user |
| GET | `/api/auth/callback` | Supabase OAuth callback |
| POST | `/api/auth/bootstrap` | Ensure profile row exists for auth user |
| GET | `/api/auth/check-username` | Validate username availability and format |

### Ingestion Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/ingest/game` | Ingest single game by title |
| POST | `/api/ingest/batch` | Ingest up to 50 games |

### Cron Routes (protected by `CRON_SECRET`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/cron/discover?secret=` | Auto-discover ~320 games |
| GET | `/api/cron/discover?secret=&deep=true` | Deep discovery ~700+ games |
| GET | `/api/cron/refresh-trending?secret=` | Manual algorithmic trending fallback (does not refresh Steam counts) |
| GET | `/api/cron/re-enrich?secret=` | Re-enrich stale game data |

### GX Corner Proxy Routes (ISR 300s)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/gx/highlights` | Hero carousel highlights |
| GET | `/api/gx/calendar` | Release calendar |
| GET | `/api/gx/free-to-play` | Free-to-play games |
| GET | `/api/gx/top-games` | PS Plus / Game Pass titles |
| GET | `/api/gx/deals` | Discounted games |
| GET | `/api/gx/top-liked` | Most liked games |
| GET | `/api/gx/news/popular` | Trending gaming news |
| GET | `/api/gx/news/feed` | Full news feed |

### Admin Routes (admin auth required)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/games` | Paginated game list with search |
| GET | `/api/admin/games/[id]` | Single game for editing |
| PATCH | `/api/admin/games/[id]` | Update game fields |
| POST | `/api/admin/games/[id]/ingest` | Force re-ingest (Full/RAWG/IGDB) |
| DELETE | `/api/admin/games/[id]/delete` | Permanently delete a game |
| GET | `/api/admin/reviews` | List all reviews |
| POST | `/api/admin/reviews` | Create editorial review |
| DELETE | `/api/admin/reviews` | Delete a review |
| POST | `/api/admin/featured` | Toggle featured/trending flags |
| GET | `/api/admin/audit` | Last 50 audit log entries |
| GET | `/api/admin/users` | User list with counts |
| POST | `/api/admin/backfill-scores` | Recompute v2 scores for all games |
| POST | `/api/admin/backfill-header-images` | Batch backfill missing header images |
| POST | `/api/admin/backfill-prices` | Batch backfill missing prices |
| GET | `/api/admin/editorial-reviews` | List editorial reviews |
| POST | `/api/admin/editorial-reviews` | Create/update editorial review |
| PATCH/DELETE | `/api/admin/editorial-reviews/[id]` | Update or delete editorial review |
| GET | `/api/admin/games/search-preview` | Preview search results before ingestion |
| POST | `/api/admin/optimize-image` | Server-side image optimization |
| GET | `/api/admin/provider-usage` | API provider usage and budget status |
| GET | `/api/admin/scheduler-runs` | Recent scheduler job executions |
| POST | `/api/admin/scheduler-runs/trigger` | Manually trigger a scheduler job |
| POST | `/api/admin/seed-lists` | Seed 22 editorial curated lists |
| GET | `/api/admin/seed-lists` | Available seed list definitions |
| POST | `/api/admin/upload` | Upload files to Supabase Storage |

---

## 7. Architecture

```
src/
├── app/
│   ├── api/                       # 70+ Next.js Route Handlers
│   │   ├── auth/                  # OAuth callback, bootstrap, me
│   │   ├── homepage/              # Homepage aggregator
│   │   ├── games/                 # Game CRUD + deals/news/achievements/steam-reviews
│   │   ├── search/                # Multi-filter search
│   │   ├── recommendations/       # Quality-gated recommendations
│   │   ├── rawg/lists/            # RAWG curated lists proxy
│   │   ├── reviews/               # Reviews + votes + comments
│   │   ├── lists/                 # Curated lists
│   │   ├── profile/               # User profiles + settings + avatar
│   │   ├── library/               # User library CRUD + stats
│   │   ├── follow/                # Follow/unfollow
│   │   ├── calendar/              # Release calendar
│   │   ├── compare/               # Game comparison
│   │   ├── developers/            # Developer hub
│   │   ├── ingest/                # Single + batch ingestion
│   │   ├── cron/                  # discover, refresh-trending, re-enrich
│   │   ├── gx/                    # 8 GX Corner proxy routes
│   │   └── admin/                 # Stats, games, reviews, users, audit, featured, backfill, seed-lists
│   ├── admin/                     # Admin dashboard pages
│   ├── game/[slug]/               # Game detail (richest page)
│   ├── search/                    # Search with 5 filter types
│   ├── explore/                   # RAWG curated lists (5 tabs)
│   └── ...                        # Calendar, reviews, lists, compare, library, profile
├── lib/
│   ├── external/                  # 9 API clients
│   │   ├── rawg.ts                # RAWG (games, search, curated lists)
│   │   ├── steam.ts               # Steam (reviews, players, pricing)
│   │   ├── igdb.ts                # IGDB/Twitch (ratings, media, PopScore)
│   │   ├── cheapshark.ts          # CheapShark (price deals)
│   │   ├── wikipedia.ts           # Wikipedia (summaries)
│   │   ├── howlongtobeat.ts       # HLTB (playtime data)
│   │   ├── gxcorner.ts            # GX Corner (8 gaming feeds)
│   │   ├── googleplay.ts          # Google Play Store (mobile verification)
│   │   └── appstore.ts            # Apple App Store (mobile verification)
│   ├── services/
│   │   ├── ingest.ts              # 13-step multi-source ingestion pipeline
│   │   ├── homepage.ts            # Homepage data aggregator (~1900 lines)
│   │   ├── search.ts              # Server-side search with composite ranking
│   │   ├── calendar.ts            # Calendar service (GX + DB merging)
│   │   ├── relatedGames.ts        # Related games algorithm
│   │   └── gx-feeds.ts            # GX feed handlers with durable cache
│   ├── supabase/                  # Database client + typed schema
│   ├── db/                        # Row mappers, column selections
│   ├── utils/                     # Scoring, quality, trending, media readiness, public safety
│   ├── auditLog.ts                # Admin audit log writer
│   ├── admin.ts                   # Admin access control
│   ├── api.ts                     # Frontend API client
│   └── types.ts                   # Frontend interfaces
├── components/                    # 48 React components
├── hooks/                         # useAuth, useTheme
scripts/                           # 35 Node.js CLI scripts
supabase/                          # Schema + 33 ordered migrations
```

---

## 8. Security Notes

- **`SUPABASE_SERVICE_ROLE_KEY`** is **never** exposed to the client — only used in `src/lib/supabase/server.ts`, imported by Route Handlers
- **`RAWG_API_KEY`**, **`STEAM_API_KEY`**, **`TWITCH_CLIENT_ID/SECRET`** are server-only, used in `src/lib/external/*.ts`
- **Cron routes** protected by `CRON_SECRET` (query param or Bearer header)
- **Admin routes** protected by `requireAdmin()` — email-list-based access control
- **All tables** have Row Level Security (RLS) enabled — public `SELECT`, `service_role`-only writes
- **Input validation**: JSON body parsing, query length (2–200), batch size (max 50), avatar MIME whitelist + 2MB limit
- **Security headers**: X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, Referrer-Policy, Permissions-Policy (in `next.config.ts`)

---

## 9. Deploying

### Frontend — Vercel

1. Push to GitHub
2. Import into Vercel
3. Add all environment variables in **Vercel → Settings → Environment Variables**
4. Set `NEXT_PUBLIC_SITE_URL` to your production URL (e.g., `https://www.verdict.games`)
5. Deploy — `vercel.json` auto-detects `nextjs` framework and intentionally leaves cron schedules disabled

### Backend Cron — GitHub Actions

The versioned workflow at `.github/workflows/scheduled-maintenance.yml` runs the existing standalone Node.js processes on `ubuntu-latest` and writes directly to Supabase. It does not call Vercel routes and does not need `CRON_SECRET`.

1. Open **GitHub → Repository → Settings → Secrets and variables → Actions**.
2. Add required repository secrets:
   - `SUPABASE_DB_URL` — use the IPv4-compatible Supabase **session pooler** URI from **Connect → Session pooler**. Session mode is required because scheduler overlap protection uses PostgreSQL session advisory locks.
   - `RAWG_API_KEY` — required by discovery and enrichment jobs.
3. Add recommended repository secrets:
   - `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` — IGDB enrichment.
   - `STEAM_API_KEY` — reliable Steam charts/player data.
4. Push the workflow to the default branch.
5. Open **Actions → Scheduled maintenance → Run workflow**, choose `refresh-trending`, and run it once to replace stale player counts immediately.

| Job | UTC schedule | Command |
|-----|--------------|---------|
| Refresh players/trending | Every 6 hours at `:17` | `node scripts/heroku-refresh-trending.mjs` |
| Re-enrich stale | 01:47 and 13:47 daily | `node scripts/heroku-re-enrich.mjs` |
| Refresh curated lists | 02:23 daily | `node scripts/seed-curated-lists.mjs` |
| Standard discovery | 03:37 daily | `node scripts/heroku-discover-games.mjs` |
| Historical backfill | 04:53 daily | `node scripts/backfill-games.mjs` |
| Android verification | Tuesday 05:29 | `node scripts/backfill-mobile-listings.mjs --android-only` |
| iOS verification | Friday 05:29 | `node scripts/backfill-mobile-listings.mjs --ios-only` |
| Deep discovery | Sunday 15:11 | `node scripts/heroku-discover-games.mjs --deep` |

The unusual minutes reduce GitHub scheduler congestion. Standard and deep discovery use independent interval histories while sharing one advisory lock, so one cannot suppress or overlap the other. PostgreSQL session advisory locks prevent duplicate execution, and Actions cache persistence preserves the historical backfill checkpoint between ephemeral runners. Scheduled workflows run only from the default branch; GitHub may delay start times during load, so monitor failures in Actions and in `/admin/scheduler`.

`keep-scheduled-workflows-active.yml` runs monthly and prevents GitHub from suspending public-repository schedules after 60 days without repository activity. Its third-party action is pinned to an immutable commit and restricted to this repository. It requires the encrypted `WORKFLOW_IMMORTALITY_TOKEN` secret with Actions read/write permission.

All scripts use `scripts/lib/ingest-pipeline.mjs` for direct DB writes via the `postgres` tagged-template library.

### Supported Platforms

The database supports games across all 11 platforms:
- **PC**, **macOS**, **Linux**
- **PlayStation 5**, **PlayStation 4**
- **Xbox Series X|S**, **Xbox One**
- **Nintendo Switch**, **Nintendo Switch 2**
- **Android**, **iOS**

---

## 10. Admin Access

Admin access is controlled by the `ADMIN_EMAILS` environment variable (comma-separated list, parsed by `src/lib/adminEmails.ts`). To add an admin:

1. Add their Supabase Auth email to the `ADMIN_EMAILS` env var (comma-separated)
2. Redeploy (or update the env var in Vercel settings)

Admins can access `/admin` for:
- **Game management** — search, edit, reingest (RAWG/IGDB/Full Pipeline), delete
- **Review moderation** — create editorial reviews, delete inappropriate reviews
- **User management** — view users with review/list/library counts
- **Audit log** — field-level diffs of all admin actions
- **Content seeding** — seed 22 editorial lists, backfill v2 scores, backfill header images/prices
- **Featured/trending** — manual override flags that persist through cron refreshes
- **API provider usage** — monitor external API usage and budgets
- **Scheduler runs** — view recent job executions, manually trigger jobs
