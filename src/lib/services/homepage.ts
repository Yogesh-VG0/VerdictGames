/**
 * VERDICT.GAMES — Homepage Service Layer
 *
 * Shared game-fetching logic used by both the /api/homepage aggregator
 * and the individual /api/games/* routes. No internal HTTP calls —
 * hits Supabase directly for minimal latency.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { mapGameRow } from "@/lib/db/mappers";
import { filterQualityGames, confidenceWeightedScore, isQualityGame } from "@/lib/utils/quality";
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
  // Factor in momentum (log-based, stored on the row)
  const momentum = (g as GameRow & { momentum?: number }).momentum ?? 0;
  const momentumBoost = Math.max(0, Math.min(20, momentum * 50));
  return (score * 0.25) + (playerScore * 0.35) + (recency * 0.25) + (momentumBoost * 0.15);
}

/* ═══════════════════════════════════════════════════
   Hero Candidates — independent pool for the carousel
   Different from trending rail: requires header art,
   higher score gate, and ordered by editorial intent.
   ═══════════════════════════════════════════════════ */

export async function fetchHeroCandidates(limit = 12): Promise<Game[]> {
  const supabase = getServerSupabase();

  // Step 1: Manually featured games (editorial priority) — no age limit
  const { data: manualFeatured } = await supabase
    .from("games")
    .select("*")
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
  const today = new Date().toISOString().slice(0, 10);

  let { data: autoPool } = await supabase
    .from("games")
    .select("*")
    .not("header_image", "is", null)
    .neq("header_image", "")
    .gte("score", 76)
    .gt("score", 0)
    .gte("confidence", 0.8)
    .gte("review_count", 10000)
    .gte("current_players", 500)
    .gte("release_date", cutoff24)
    .lte("release_date", today)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(40) as { data: GameRow[] | null };

  // Widen to 36mo if pool is thin
  if (!autoPool || autoPool.length < 6) {
    const wider = await supabase
      .from("games")
      .select("*")
      .not("header_image", "is", null)
      .neq("header_image", "")
      .gte("score", 72)
      .gt("score", 0)
      .gte("confidence", 0.8)
      .gte("review_count", 10000)
      .gte("current_players", 500)
      .gte("release_date", cutoff36)
      .lte("release_date", today)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(40) as { data: GameRow[] | null };
    autoPool = wider.data;
  }

  const manualIds = new Set((manualFeatured ?? []).map((g) => g.id));
  const autoDeduped = (autoPool ?? []).filter((g) => !manualIds.has(g.id));
  const combined = deduplicateBySteamAppId([...(manualFeatured ?? []), ...autoDeduped]);

  // Quality filter: hero needs well-known games (1000+ reviews, confidence>=0.8)
  // Don't use the default fallback (which returns ALL unfiltered) — instead, always
  // sort by confidence and take the best available even if fewer than minResults pass.
  const strictFiltered = combined.filter((r) => isQualityGame(r, "hero"));
  const qualityFiltered = strictFiltered.length >= 4
    ? strictFiltered
    : [...combined].sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a)).slice(0, 12);

  // Sort: manual featured first → then by confidence-weighted score (penalizes few-review games)
  qualityFiltered.sort((a, b) => {
    if (a.is_featured_manual && !b.is_featured_manual) return -1;
    if (!a.is_featured_manual && b.is_featured_manual) return 1;
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return confidenceWeightedScore(b) - confidenceWeightedScore(a);
  });

  return qualityFiltered.slice(0, limit).map(mapGameRow);
}

export async function fetchTrendingGames(limit = 20, homepageOnly = true): Promise<Game[]> {
  const supabase = getServerSupabase();

  // Step 1: Load manually-flagged trending seeds (these get priority slots in the rail)
  const { data: flagged, error } = await supabase
    .from("games")
    .select("*")
    .eq("trending", true)
    .limit(40) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  // Step 2: Always load a scoring-based pool to fill remaining slots
  // Over-fetch 4× limit so quality filtering + dedup still leaves enough
  const cutoff4yr = monthsAgoISO(48);
  const today = new Date().toISOString().slice(0, 10);

  const { data: pool } = await supabase
    .from("games")
    .select("*")
    .not("release_date", "is", null)
    .gte("release_date", cutoff4yr)
    .lte("release_date", today)
    .gt("score", 0)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(limit * 6) as { data: GameRow[] | null };

  // Step 3: Build combined candidate set — flagged first, then scored pool
  const flaggedIds = new Set((flagged ?? []).map((g) => g.id));
  const poolDeduped = (pool ?? []).filter((g) => !flaggedIds.has(g.id));
  const allCandidates = deduplicateBySteamAppId([...(flagged ?? []), ...poolDeduped]);

  // Step 4: Quality filter
  const qualified = filterQualityGames(allCandidates, { section: "trending", minResults: 4 });

  // Step 5: Apply recency gate (graduated) — but only for homepage
  let recencyFiltered: GameRow[];
  if (homepageOnly) {
    recencyFiltered = qualified.filter(isHomepageTrendingEligible);
    if (recencyFiltered.length < limit) {
      recencyFiltered = qualified.filter((r) => isRecentEnoughForHome(r, HOMEPAGE_TRENDING_FALLBACK_MONTHS));
    }
    if (recencyFiltered.length < limit) {
      recencyFiltered = qualified.filter((r) => isRecentEnoughForHome(r, HOMEPAGE_TRENDING_LAST_RESORT_MONTHS));
    }
    if (recencyFiltered.length < 4) recencyFiltered = qualified;
  } else {
    recencyFiltered = qualified;
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

  return ranked.slice(0, limit).map(mapGameRow);
}

/* ═══════════════════════════════════════════════════
   New Releases (extracted from /api/games/new-releases)
   ═══════════════════════════════════════════════════ */

function dateCutoff(yearsBack: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsBack);
  return d.toISOString().slice(0, 10);
}

export async function fetchNewReleases(limit = 20): Promise<Game[]> {
  const supabase = getServerSupabase();
  const fetchLimit = limit * 2; // over-fetch for quality filtering

  // Try last 2 years first
  let { data, error } = await supabase
    .from("games")
    .select("*")
    .not("release_date", "is", null)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .gte("release_date", dateCutoff(2))
    .order("release_date", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  // Fallback to 5 years if insufficient
  if (!error && (!data || data.length < limit)) {
    const fallback = await supabase
      .from("games")
      .select("*")
      .not("release_date", "is", null)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .gte("release_date", dateCutoff(5))
      .order("release_date", { ascending: false })
      .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

    if (!fallback.error && fallback.data && fallback.data.length > (data?.length ?? 0)) {
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) throw error;

  const filtered = filterQualityGames(data ?? [], { section: "newReleases", minResults: 4 });
  return filtered.slice(0, limit).map(mapGameRow);
}

/* ═══════════════════════════════════════════════════
   Top Rated (extracted from /api/games/top-rated)
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
    .select("*")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  const filtered = filterQualityGames(data ?? [], { section: "topRated", minResults: 4 });
  // Sort by confidence-weighted score so tiny-sample 100% games don't dominate
  filtered.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));
  return filtered.slice(0, limit).map(mapGameRow);
}

/**
 * Homepage top rated — "Top Rated Right Now".
 * Only recent releases (24mo, fallback 36mo) so the homepage feels current.
 */
export async function fetchHomepageTopRated(limit = 20): Promise<Game[]> {
  const supabase = getServerSupabase();
  const fetchLimit = limit * 4;
  const cutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_MONTHS);

  let { data, error } = await supabase
    .from("games")
    .select("*")
    .not("release_date", "is", null)
    .gte("release_date", cutoff)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  let filtered = filterQualityGames(data ?? [], { section: "topRated", minResults: 4 });

  // Fallback: widen to 36 months if not enough
  if (filtered.length < limit) {
    const widerCutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_FALLBACK_MONTHS);
    const fallback = await supabase
      .from("games")
      .select("*")
      .not("release_date", "is", null)
      .gte("release_date", widerCutoff)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

    if (!fallback.error && fallback.data) {
      filtered = filterQualityGames(fallback.data, { section: "topRated", minResults: 4 });
    }
  }

  // Sort by confidence-weighted score so games with few reviews don't dominate
  filtered.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));

  return filtered.slice(0, limit).map(mapGameRow);
}

/**
 * Homepage recommendations — recent high-quality picks for anonymous users.
 * Avoids all-time classics dominating the homepage.
 */
export async function fetchHomepageRecommendations(limit = 20): Promise<Game[]> {
  const supabase = getServerSupabase();
  const fetchLimit = limit * 8;
  const cutoff = monthsAgoISO(HOMEPAGE_REC_MONTHS);

  const { data, error } = await supabase
    .from("games")
    .select("*")
    .not("release_date", "is", null)
    .gte("release_date", cutoff)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .gte("score", 75)
    .gte("review_count", 20)              // minimum review threshold
    .not("cover_image", "is", null)       // must have cover image
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  // Quality filter: require 50+ reviews, image, description
  let filtered = filterQualityGames(data ?? [], { section: "topRated", minResults: 4 });

  // Exclude provisional / coming soon
  filtered = filtered.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (r.release_date && r.release_date > new Date().toISOString().slice(0, 10)) return false;
    return true;
  });

  // Sort by confidence-weighted score so low-review 100% games don't dominate
  filtered.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));

  // Genre diversity: pick one per primary genre first
  const seen = new Set<string>();
  const picks: GameRow[] = [];
  for (const row of filtered) {
    if (picks.length >= limit) break;
    const primary = (row.genres?.[0] ?? "unknown").toLowerCase();
    if (!seen.has(primary) || seen.size >= 8) {
      seen.add(primary);
      picks.push(row);
    }
  }
  // Fill remaining
  if (picks.length < limit) {
    const pickIds = new Set(picks.map((p) => p.id));
    for (const row of filtered) {
      if (picks.length >= limit) break;
      if (!pickIds.has(row.id)) picks.push(row);
    }
  }

  return picks.map(mapGameRow);
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
      buyUrl: entry.game.prices?.[0]?.url ?? null,
      storeName: entry.store?.name ?? null,
      storeColor: entry.store?.color ?? null,
      badge: entry.tag?.name ?? null,
      dealType: entry.dealType,
      genres: entry.game.genres.map((g) => g.name),
    }));
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════
   Homepage Aggregator — single call, all sections
   ═══════════════════════════════════════════════════ */

export interface HomepageData {
  hero: Game[];        // carousel candidates — distinct from trending rail
  trending: Game[];    // trending rail — pre-deduped against hero
  topRated: Game[];
  newReleases: Game[];
  deals: GXDeal[];
}

export async function fetchHomepageData(): Promise<HomepageData> {
  const [hero, trending, topRated, newReleases, deals] = await Promise.all([
    fetchHeroCandidates(12).catch(() => [] as Game[]),
    fetchTrendingGames(26, true).catch(() => [] as Game[]),
    fetchHomepageTopRated(20).catch(() => [] as Game[]),
    fetchNewReleases(20).catch(() => [] as Game[]),
    fetchDeals().catch(() => [] as GXDeal[]),
  ]);

  // Pre-deduplicate trending rail against hero pool
  // Hero top-4 candidates must not appear in the trending rail
  const heroTopIds = new Set(hero.slice(0, 4).map((g) => g.id));
  const trendingDeduped = trending.filter((g) => !heroTopIds.has(g.id));

  return { hero, trending: trendingDeduped, topRated, newReleases, deals };
}
