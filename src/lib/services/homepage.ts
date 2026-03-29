/**
 * VERDICT.GAMES — Homepage Service Layer
 *
 * Shared game-fetching logic used by both the /api/homepage aggregator
 * and the individual /api/games/* routes. No internal HTTP calls —
 * hits Supabase directly for minimal latency.
 *
 * ─── Section Contracts ───────────────────────────────────────────
 * Hero:          Editorial + high-quality, visually stunning games
 * Trending:      Genuine current momentum / player-count surge
 * Top Rated:     Confidence-weighted best-scored recent games
 * New Releases:  Card-ready recently released games (newest first)
 * Upcoming:      Chronological upcoming/confirmed releases
 * Recently Added:Newly ingested games that pass readiness
 * Recommendations:Anonymous high-quality discovery (homepage)
 *
 * ─── Invariants ──────────────────────────────────────────────────
 * • Quality scoring ≠ surface readiness (never conflated)
 * • Every public rail output passes isSurfaceReady('homepageRail')
 * • Global homepage dedup: each game appears in exactly one rail
 * • Hero/Featured is NEVER derived from trending
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { filterQualityGames, confidenceWeightedScore, isQualityGame, isSurfaceReady } from "@/lib/utils/quality";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import type { GameRow } from "@/lib/supabase/types";
import type { Game, GXDeal } from "@/lib/types";

/* ═══════════════════════════════════════════════════
   Homepage Recency Helpers
   Keep home feeling current — old classics belong on
   explore/search/top-rated pages, not the homepage.
   ═══════════════════════════════════════════════════ */

const HOMEPAGE_TRENDING_MONTHS = 24;
const HOMEPAGE_TRENDING_FALLBACK_MONTHS = 36;
const HOMEPAGE_TRENDING_LAST_RESORT_MONTHS = 60;
const HOMEPAGE_TOP_RATED_MONTHS = 24;
const HOMEPAGE_TOP_RATED_FALLBACK_MONTHS = 36;
const HOMEPAGE_REC_MONTHS = 36;

function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function isRecentEnoughForHome(row: GameRow, months: number): boolean {
  if (!row.release_date) return false;
  return row.release_date >= monthsAgoISO(months);
}

function isHomepageTrendingEligible(row: GameRow): boolean {
  // Strict recency — no evergreen/player-count override on homepage
  return isRecentEnoughForHome(row, HOMEPAGE_TRENDING_MONTHS);
}

/* ═══════════════════════════════════════════════════
   Trending logic (extracted from /api/games/trending)
   ═══════════════════════════════════════════════════ */

const DECAY_DAYS = 365;

function deduplicateBySteamAppId(games: GameRow[]): GameRow[] {
  const byAppId = new Map<number, GameRow>();
  for (const g of games) {
    const appId = g.steam_app_id;
    if (appId == null) continue;
    const existing = byAppId.get(appId);
    if (!existing || (g.release_date && (!existing.release_date || g.release_date > existing.release_date))) {
      byAppId.set(appId, g);
    }
  }
  const chosenIds = new Set(Array.from(byAppId.values()).map((g) => g.id));
  return games.filter((g) => g.steam_app_id == null || chosenIds.has(g.id));
}

function trendingRank(g: GameRow, minPlayers: number, maxPlayers: number): number {
  const score = g.verdict_score ?? g.score ?? 0;
  const playerCount = g.current_players ?? 0;
  const logPlayers = Math.log10(playerCount + 1);
  const logMin = Math.log10(Math.max(minPlayers, 0) + 1);
  const logMax = Math.log10(Math.max(maxPlayers, 1) + 1);
  const spread = logMax - logMin || 1;
  const playerScore = Math.min(100, ((logPlayers - logMin) / spread) * 100);
  const ageMs = Date.now() - new Date(g.release_date ?? "2000-01-01").getTime();
  const ageDays = ageMs / 86400000;
  const recency = Math.min(100, Math.exp(-ageDays / DECAY_DAYS) * 100);
  // Factor in momentum (log-based, stored on the row) — raised to 25% weight
  const momentum = (g as GameRow & { momentum?: number }).momentum ?? 0;
  const momentumBoost = Math.max(0, Math.min(25, momentum * 65));
  return (score * 0.20) + (playerScore * 0.30) + (recency * 0.25) + (momentumBoost * 0.25);
}

/* ═══════════════════════════════════════════════════
   Genre Diversity Helper
   Caps how many games from one primary genre can appear
   ═══════════════════════════════════════════════════ */

function applyGenreDiversity(rows: GameRow[], limit: number, maxPerGenre: number): GameRow[] {
  const genreCounts = new Map<string, number>();
  const picks: GameRow[] = [];
  const overflow: GameRow[] = [];

  for (const row of rows) {
    if (picks.length >= limit) break;
    const primary = (row.genres?.[0] ?? "unknown").toLowerCase();
    const count = genreCounts.get(primary) ?? 0;
    if (count < maxPerGenre) {
      genreCounts.set(primary, count + 1);
      picks.push(row);
    } else {
      overflow.push(row);
    }
  }

  // Fill remaining from overflow (genre limits exceeded, but need more games)
  if (picks.length < limit) {
    const pickIds = new Set(picks.map((p) => p.id));
    for (const row of overflow) {
      if (picks.length >= limit) break;
      if (!pickIds.has(row.id)) picks.push(row);
    }
  }

  return picks;
}

/* ═══════════════════════════════════════════════════
   Hero Candidates — CONTRACT
   ─────────────────────────────────────────────────
   Purpose:  Editorial + visually stunning games
   Requires: header_image, cover_image, score>=72, confidence>=0.5
   Excludes: is_provisional, no header_image, unreleased (unless editorial)
   Scoring:  40% editorial, 30% verdict_score, 20% review volume, 10% recency
   Diversity: Max 2 per primary genre
   RULE:     NEVER derived from trending. Only from is_featured_manual + auto pool.
   ═══════════════════════════════════════════════════ */

export async function fetchHeroCandidates(limit = 12): Promise<Game[]> {
  const supabase = getServerSupabase();

  // Step 1: Manually featured games (editorial priority) — no age limit
  // RULE: Hero sourced from is_featured_manual flag, NEVER from trending flag
  const { data: manualFeatured } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .eq("is_featured_manual", true)
    .not("header_image", "is", null)
    .neq("header_image", "")
    .gte("score", 72)
    .gt("score", 0)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(6) as { data: GameRow[] | null };

  // Step 2: Auto-selected recent high-quality games with header art
  const cutoff24 = monthsAgoISO(24);
  const cutoff36 = monthsAgoISO(36);
  const cutoff60 = monthsAgoISO(60);
  const today = new Date().toISOString().slice(0, 10);

  let { data: autoPool } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("header_image", "is", null)
    .neq("header_image", "")
    .gte("score", 76)
    .gt("score", 0)
    .gte("confidence", 0.5)
    .gte("review_count", 5000)
    .gte("release_date", cutoff24)
    .lte("release_date", today)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(40) as { data: GameRow[] | null };

  // Widen to 36mo if pool is thin
  if (!autoPool || autoPool.length < 6) {
    const wider = await supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("header_image", "is", null)
      .neq("header_image", "")
      .gte("score", 72)
      .gt("score", 0)
      .gte("confidence", 0.5)
      .gte("review_count", 3000)
      .gte("release_date", cutoff36)
      .lte("release_date", today)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(40) as { data: GameRow[] | null };
    autoPool = wider.data;
  }

  // Last resort: widen to 60mo and drop confidence to 0.3
  if (!autoPool || autoPool.length < 4) {
    const widest = await supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("header_image", "is", null)
      .neq("header_image", "")
      .gte("score", 72)
      .gt("score", 0)
      .gte("confidence", 0.3)
      .gte("review_count", 1000)
      .gte("release_date", cutoff60)
      .lte("release_date", today)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(40) as { data: GameRow[] | null };
    autoPool = widest.data;
  }

  const manualIds = new Set((manualFeatured ?? []).map((g) => g.id));
  const autoDeduped = (autoPool ?? []).filter((g) => !manualIds.has(g.id));
  const combined = deduplicateBySteamAppId([...(manualFeatured ?? []), ...autoDeduped]);

  // Surface readiness gate + public safety + media readiness + quality filter
  const ready = combined.filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );
  const strictFiltered = ready.filter((r) => isQualityGame(r, "hero"));
  const qualityFiltered = strictFiltered.length >= 4
    ? strictFiltered
    : [...ready].sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a)).slice(0, limit * 2);

  // Composite score: 40% editorial, 30% verdict, 20% review volume, 10% recency
  const heroScore = (g: GameRow): number => {
    const editorial = g.is_featured_manual ? 40 : 0;
    const verdict = Math.min(30, ((g.verdict_score ?? g.score ?? 0) / 100) * 30);
    const volume = Math.min(20, Math.log10((g.review_count ?? 0) + 1) * 4);
    const ageMs = Date.now() - new Date(g.release_date ?? "2000-01-01").getTime();
    const ageDays = ageMs / 86400000;
    const recency = Math.min(10, Math.exp(-ageDays / 365) * 10);
    return editorial + verdict + volume + recency;
  };

  qualityFiltered.sort((a, b) => heroScore(b) - heroScore(a));

  // Genre diversity: max 2 per primary genre
  const diversified = applyGenreDiversity(qualityFiltered, limit, 2);

  return diversified.map(mapGameRow);
}

/* ═══════════════════════════════════════════════════
   Trending — CONTRACT
   ─────────────────────────────────────────────────
   Purpose:  Games with genuine current momentum/surge
   Requires: cover_image, score>0, released
   Excludes: is_provisional, unreleased
   Scoring:  20% score, 30% players, 25% recency, 25% momentum
   Diversity: Max 3 per primary genre
   ═══════════════════════════════════════════════════ */

export async function fetchTrendingGames(limit = 20, homepageOnly = true): Promise<Game[]> {
  const supabase = getServerSupabase();

  // Step 1: Load manually-flagged trending seeds (these get priority slots in the rail)
  const { data: flagged, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .eq("trending", true)
    .limit(40) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  // Step 2: Always load a scoring-based pool to fill remaining slots
  // Over-fetch 4× limit so quality filtering + dedup still leaves enough
  const cutoff4yr = monthsAgoISO(48);
  const today = new Date().toISOString().slice(0, 10);

  const { data: pool } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("release_date", "is", null)
    .gte("release_date", cutoff4yr)
    .lte("release_date", today)
    .gt("score", 0)
    .not("cover_image", "is", null)        // Cover image required at DB level
    .neq("cover_image", "")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(limit * 6) as { data: GameRow[] | null };

  // Step 3: Build combined candidate set — flagged first, then scored pool
  const flaggedIds = new Set((flagged ?? []).map((g) => g.id));
  const poolDeduped = (pool ?? []).filter((g) => !flaggedIds.has(g.id));
  const allCandidates = deduplicateBySteamAppId([...(flagged ?? []), ...poolDeduped]);

  // Step 4: Quality filter + surface readiness + public safety + media readiness
  const qualityFiltered = filterQualityGames(allCandidates, { section: "trending", minResults: 4 });
  const readyFiltered = qualityFiltered.filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );

  // Step 5: Apply recency gate (graduated) — but only for homepage
  let recencyFiltered: GameRow[];
  if (homepageOnly) {
    recencyFiltered = readyFiltered.filter(isHomepageTrendingEligible);
    if (recencyFiltered.length < limit) {
      recencyFiltered = readyFiltered.filter((r) => isRecentEnoughForHome(r, HOMEPAGE_TRENDING_FALLBACK_MONTHS));
    }
    if (recencyFiltered.length < limit) {
      recencyFiltered = readyFiltered.filter((r) => isRecentEnoughForHome(r, HOMEPAGE_TRENDING_LAST_RESORT_MONTHS));
    }
    if (recencyFiltered.length < 4) recencyFiltered = readyFiltered;
  } else {
    recencyFiltered = readyFiltered;
  }

  // Step 6: Rank by trending score — flagged games get a fixed boost
  const players = recencyFiltered.map((g) => g.current_players ?? 0);
  const minP = Math.min(...players);
  const maxP = Math.max(1, ...players);

  const ranked = [...recencyFiltered].sort((a, b) => {
    // Flagged games float to the top regardless of raw score
    const aFlagged = (a as GameRow & { trending?: boolean }).trending ? 1 : 0;
    const bFlagged = (b as GameRow & { trending?: boolean }).trending ? 1 : 0;
    if (bFlagged !== aFlagged) return bFlagged - aFlagged;
    return trendingRank(b, minP, maxP) - trendingRank(a, minP, maxP);
  });

  // Genre diversity: max 3 per primary genre
  const diversified = applyGenreDiversity(ranked, limit, 3);

  return diversified.map(mapGameRow);
}

/* ═══════════════════════════════════════════════════
   New Releases — CONTRACT
   ─────────────────────────────────────────────────
   Purpose:  Card-ready recently released games
   Requires: cover_image, description not empty, release_date<=today
   Excludes: is_provisional (unless review_count>50), unreleased
   Sorting:  release_date DESC (newest first)
   Recency:  2 years, fallback 5 years
   ═══════════════════════════════════════════════════ */

function dateCutoff(yearsBack: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsBack);
  return d.toISOString().slice(0, 10);
}

export async function fetchNewReleases(limit = 20): Promise<Game[]> {
  const supabase = getServerSupabase();
  const fetchLimit = limit * 3; // over-fetch for quality filtering + dedup

  // Try last 2 years first
  let { data, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("release_date", "is", null)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .gte("release_date", dateCutoff(2))
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .neq("description", "")
    .order("release_date", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  // Fallback to 5 years if insufficient
  if (!error && (!data || data.length < limit)) {
    const fallback = await supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("release_date", "is", null)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .gte("release_date", dateCutoff(5))
      .not("cover_image", "is", null)
      .neq("cover_image", "")
      .neq("description", "")
      .order("release_date", { ascending: false })
      .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

    if (!fallback.error && fallback.data && fallback.data.length > (data?.length ?? 0)) {
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) throw error;

  // Surface readiness + public safety + media readiness + quality filter
  const ready = (data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );
  const filtered = filterQualityGames(ready, { section: "newReleases", minResults: 4 });

  // Exclude provisional unless well-reviewed, exclude COMING SOON, exclude future dates
  const today = new Date().toISOString().slice(0, 10);
  const final = filtered.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional && r.review_count < 50) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (r.release_date && r.release_date > today) return false;
    return true;
  });

  return final.slice(0, limit).map(mapGameRow);
}

/* ═══════════════════════════════════════════════════
   Top Rated — CONTRACT
   ─────────────────────────────────────────────────
   Purpose:  Confidence-weighted best-scored recent games
   Requires: cover_image, review_count>=50, confidence>=0.3
   Excludes: is_provisional, COMING SOON
   Scoring:  confidenceWeightedScore()
   Homepage: 24mo, fallback 36mo
   ═══════════════════════════════════════════════════ */

/**
 * All-time top rated — used by /api/games/top-rated and explore pages.
 * No recency filter.
 */
export async function fetchTopRated(limit = 10): Promise<Game[]> {
  const supabase = getServerSupabase();
  const fetchLimit = limit * 4;

  const { data, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .gte("review_count", 50)
    .gte("confidence", 0.3)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  const ready = (data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );
  const filtered = filterQualityGames(ready, { section: "topRated", minResults: 4 });

  // Exclude provisional / coming soon
  const clean = filtered.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (r.release_date && r.release_date > new Date().toISOString().slice(0, 10)) return false;
    return true;
  });

  // Sort by confidence-weighted score so tiny-sample 100% games don't dominate
  clean.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));
  return clean.slice(0, limit).map(mapGameRow);
}

/**
 * Homepage top rated — "Top Rated Right Now".
 * Only recent releases (24mo, fallback 36mo) so the homepage feels current.
 */
export async function fetchHomepageTopRated(limit = 20): Promise<Game[]> {
  const supabase = getServerSupabase();
  const fetchLimit = limit * 4;
  const cutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_MONTHS);

  const { data, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("release_date", "is", null)
    .gte("release_date", cutoff)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .gte("review_count", 50)
    .gte("confidence", 0.3)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  let ready = (data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );
  let filtered = filterQualityGames(ready, { section: "topRated", minResults: 4 });

  // Fallback: widen to 36 months if not enough
  if (filtered.length < limit) {
    const widerCutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_FALLBACK_MONTHS);
    const fallback = await supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("release_date", "is", null)
      .gte("release_date", widerCutoff)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .not("cover_image", "is", null)
      .neq("cover_image", "")
      .gte("review_count", 50)
      .gte("confidence", 0.3)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

    if (!fallback.error && fallback.data) {
      ready = fallback.data.filter((r) =>
        isSurfaceReady(r, "homepageRail") &&
        isPublicSafeGame(r) &&
        hasUsableCardImage(r)
      );
      filtered = filterQualityGames(ready, { section: "topRated", minResults: 4 });
    }
  }

  // Exclude provisional / coming soon
  filtered = filtered.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (r.release_date && r.release_date > new Date().toISOString().slice(0, 10)) return false;
    return true;
  });

  // Sort by confidence-weighted score so games with few reviews don't dominate
  filtered.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));

  // Genre diversity: one per genre first, then fill
  const diversified = applyGenreDiversity(filtered, limit, 2);

  return diversified.map(mapGameRow);
}

/* ═══════════════════════════════════════════════════
   Recommendations (anonymous) — CONTRACT
   ─────────────────────────────────────────────────
   Purpose:  Safe, broad, high-quality discovery (logged-out)
   Requires: cover_image, review_count>=50, confidence>=0.4, score>=75
   Excludes: is_provisional, COMING SOON
   Diversity: Max 1 per primary genre (enforced)
   ═══════════════════════════════════════════════════ */

export async function fetchHomepageRecommendations(limit = 20): Promise<Game[]> {
  const supabase = getServerSupabase();
  const fetchLimit = limit * 8;
  const cutoff = monthsAgoISO(HOMEPAGE_REC_MONTHS);

  const { data, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("release_date", "is", null)
    .gte("release_date", cutoff)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .gte("score", 75)
    .gte("review_count", 50)
    .gte("confidence", 0.4)
    .not("cover_image", "is", null)       // must have cover image
    .neq("cover_image", "")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  // Surface readiness + public safety + media readiness gate
  const ready = (data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );

  // Exclude provisional / coming soon
  const clean = ready.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (r.verdict_label === "COMING SOON") return false;
    return true;
  });

  // Sort by confidence-weighted score
  clean.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));

  // Genre diversity: max 1 per genre for anonymous recs (broad discovery)
  const diversified = applyGenreDiversity(clean, limit, 1);

  return diversified.map(mapGameRow);
}

/* ═══════════════════════════════════════════════════
   GX Deals (mapped from GX Corner external API)
   ═══════════════════════════════════════════════════ */

export async function fetchDeals(): Promise<GXDeal[]> {
  try {
    const { getGXDeals } = await import("@/lib/external/gxcorner");
    const raw = await getGXDeals();
    return raw.map((entry) => ({
      id: entry.id,
      title: entry.game.title,
      cover: entry.game.imageCoverVertical?.url ?? null,
      discount: entry.game.prices?.[0]?.discount ?? null,
      price: entry.game.prices?.[0]?.price ?? null,
      currency: entry.game.prices?.[0]?.currency?.abbr ?? null,
      buyUrl: entry.game.prices?.[0]?.url ?? entry.url ?? null,
      storeName: entry.store?.name ?? null,
      storeColor: entry.store?.color ?? null,
      badge: entry.tag?.name ?? null,
      dealType: entry.dealType,
      genres: entry.game.genres.map((g) => g.name),
      platforms: entry.game.platforms.map((p) => p.name),
    }));
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════
   Homepage Aggregator — single call, all sections
   with strict global deduplication and refill logic

   Dedup Priority: Hero > Trending > Top Rated > New Releases > Recommendations
   Each game appears in exactly ONE rail on the homepage.
   ═══════════════════════════════════════════════════ */

export interface HomepageData {
  hero: Game[];        // carousel candidates — editorially distinct from trending
  trending: Game[];    // trending rail — genuine momentum
  topRated: Game[];
  newReleases: Game[];
  deals: GXDeal[];
  recommendations: Game[];  // anonymous recommendations
}

export async function fetchHomepageData(): Promise<HomepageData> {
  // Fetch all sections in parallel — each overfetches for dedup headroom
  const [heroRaw, trendingRaw, topRatedRaw, newReleasesRaw, deals, recsRaw] = await Promise.all([
    fetchHeroCandidates(24).catch(() => [] as Game[]),         // 2× target for dedup
    fetchTrendingGames(40, true).catch(() => [] as Game[]),    // 2× target
    fetchHomepageTopRated(40).catch(() => [] as Game[]),       // 2× target
    fetchNewReleases(40).catch(() => [] as Game[]),            // 2× target
    fetchDeals().catch(() => [] as GXDeal[]),
    fetchHomepageRecommendations(40).catch(() => [] as Game[]),// 2× target
  ]);

  // ─── Global Dedup: each game in exactly one rail ───
  const usedIds = new Set<string>();

  function claimSlots(candidates: Game[], max: number): Game[] {
    const result: Game[] = [];
    for (const g of candidates) {
      if (result.length >= max) break;
      if (!usedIds.has(g.id)) {
        usedIds.add(g.id);
        result.push(g);
      }
    }
    return result;
  }

  // Claim in priority order
  const hero = claimSlots(heroRaw, 12);
  const trending = claimSlots(trendingRaw, 20);
  const topRated = claimSlots(topRatedRaw, 20);
  const newReleases = claimSlots(newReleasesRaw, 20);
  const recommendations = claimSlots(recsRaw, 20);

  return { hero, trending, topRated, newReleases, deals, recommendations };
}
