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
 * • Hero/Featured is NEVER derived from trending. Only from is_featured_manual + auto pool.
 */

import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "@/lib/supabase/public";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { isFutureDate } from "@/lib/utils";
import {
  filterQualityGames,
  confidenceWeightedScore,
  getCriticSourceCount,
  getEvidenceReviewCount,
  getNewReleaseDiscoveryScore,
  hasStrongCriticEvidence,
  isQualityGame,
  isSurfaceReady,
} from "@/lib/utils/quality";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { getHomepageHeroScore, isHomepageHeroAutoCandidate } from "@/lib/utils/homepageHero";
import {
  getPublicTrendingScore,
  hasBrowseTrendingSignal,
  isAcceptableTrendingCandidate,
  isPremiumTrendingCandidate,
  preferTrendingMomentumPool,
} from "@/lib/utils/trending";
import type { GameRow } from "@/lib/supabase/types";
import type { Game, GXDeal } from "@/lib/types";
import type { RawgListItem } from "@/lib/external/rawg";

/* ═══════════════════════════════════════════════════
   Homepage Recency Helpers
   Keep home feeling current — old classics belong on
   explore/search/top-rated pages, not the homepage.
   ═══════════════════════════════════════════════════ */

const HOMEPAGE_TRENDING_MONTHS = 36;
const HOMEPAGE_TRENDING_FALLBACK_MONTHS = 60;
const HOMEPAGE_TRENDING_LAST_RESORT_MONTHS = 120;
const HOMEPAGE_TOP_RATED_MONTHS = 24;
const HOMEPAGE_TOP_RATED_FALLBACK_MONTHS = 36;
const HOMEPAGE_REC_MONTHS = 36;
const HOMEPAGE_REC_FALLBACK_MONTHS = 60;
const HOMEPAGE_HERO_TARGET = 6;
const HOMEPAGE_RAIL_TARGET = 20;
const HOMEPAGE_PRIORITY_FLOOR = 8;
const HOMEPAGE_TOP_RATED_RESERVED_TARGET = 8;

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
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;
  const ageDays = row.release_date
    ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;
  const hasSharedTrendingSignal = hasBrowseTrendingSignal(row);

  if (row.is_trending_manual ?? false) {
    return true;
  }

  if (!hasSharedTrendingSignal) {
    return false;
  }

  if (isRecentEnoughForHome(row, HOMEPAGE_TRENDING_MONTHS)) {
    return true;
  }

  return ((row.trending ?? false) && currentPlayers >= 12000 && momentum >= 0.04)
    || (ageDays <= 730 && currentPlayers >= 8000 && momentum >= 0.05)
    || (currentPlayers >= 18000 && momentum >= 0.05)
    || (momentum >= 0.14 && currentPlayers >= 700);
}

function deduplicateBySteamAppId(games: GameRow[]): GameRow[] {
  return dedupePublicCanonicalRows(games);
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

function getHomepageTopRatedScore(row: GameRow): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const criticSources = getCriticSourceCount(row);
  const reviewScore = Math.min(12, Math.log10(evidenceReviewCount + 1) * 2.8);
  const activityScore = Math.min(8, Math.log10((row.current_players ?? 0) + 1) * 2.1);
  const ageDays = row.release_date
    ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;
  const recencyScore = ageDays <= 90
    ? 10
    : ageDays <= 180
      ? 8
      : ageDays <= 365
        ? 5
        : ageDays <= 730
          ? 2
          : 0;
  const criticBonus = criticSources >= 2 ? 4 : criticSources === 1 ? 1.5 : 0;
  const livePresenceBonus = (row.current_players ?? 0) >= 5000
    ? 8
    : (row.current_players ?? 0) >= 1500
      ? 5
      : (row.current_players ?? 0) >= 500
        ? 2
        : 0;
  const lowPresencePenalty = ageDays > 45 && (row.current_players ?? 0) < 500 && evidenceReviewCount < 5000 && criticSources < 2
    ? 22
    : ageDays > 7 && (row.current_players ?? 0) < 100 && evidenceReviewCount < 10000 && criticSources < 2
      ? 18
    : ageDays > 30 && (row.current_players ?? 0) < 300 && evidenceReviewCount < 25000 && criticSources < 2
      ? 16
      : ageDays > 180 && (row.current_players ?? 0) < 150 && evidenceReviewCount < 10000 && criticSources < 2
        ? 8
        : 0;
  const scaleBonus = evidenceReviewCount >= 50000
    ? 8
    : evidenceReviewCount >= 10000
      ? 4
      : 0;

  return qualityScore + reviewScore + activityScore + recencyScore + criticBonus + scaleBonus + livePresenceBonus - lowPresencePenalty;
}

function getHomepageTopRatedEvidenceTier(row: GameRow): number {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;

  if (
    evidenceReviewCount >= 50000
    || (evidenceReviewCount >= 10000 && currentPlayers >= 250)
    || (evidenceReviewCount >= 5000 && currentPlayers >= 750)
    || hasStrongCriticEvidence(row)
  ) {
    return 2;
  }

  if (
    evidenceReviewCount >= 10000
    || (evidenceReviewCount >= 5000 && currentPlayers >= 250)
    || (evidenceReviewCount >= 2500 && currentPlayers >= 500)
    || hasStrongCriticEvidence(row)
  ) {
    return 1;
  }

  return 0;
}

function isHomepageTopRatedEligible(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const ageDays = row.release_date
    ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;

  if (evidenceReviewCount >= 50000) {
    return true;
  }

  if (hasStrongCriticEvidence(row)) {
    return evidenceReviewCount >= 5000
      || currentPlayers >= 250
      || (ageDays <= 45 && evidenceReviewCount >= 1500 && currentPlayers >= 100);
  }

  if (evidenceReviewCount >= 10000 && currentPlayers >= 100) {
    return true;
  }

  if (evidenceReviewCount >= 5000 && currentPlayers >= 250) {
    return true;
  }

  return evidenceReviewCount >= 2500 && currentPlayers >= 1000;
}

function preferHomepageTopRatedPool(rows: GameRow[], desiredCount: number): GameRow[] {
  const elitePool = rows.filter((row) => confidenceWeightedScore(row) >= 88 && getHomepageTopRatedEvidenceTier(row) >= 2);
  if (elitePool.length >= Math.min(desiredCount, 12)) {
    return elitePool;
  }

  const strongPool = rows.filter((row) => confidenceWeightedScore(row) >= 84 && getHomepageTopRatedEvidenceTier(row) >= 1);
  if (strongPool.length >= Math.min(desiredCount, 12)) {
    return strongPool;
  }

  return rows;
}

function preferHomepageTrendingQualityPool(rows: GameRow[], desiredCount: number): GameRow[] {
  const premiumPool = rows.filter(isPremiumTrendingCandidate);
  if (premiumPool.length >= desiredCount) {
    return premiumPool;
  }

  const strongPool = rows.filter(isAcceptableTrendingCandidate);
  if (strongPool.length >= desiredCount) {
    return strongPool;
  }

  return rows;
}

function getHomepageTrendingScore(row: GameRow): number {
  const base = getPublicTrendingScore(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;
  const ageDays = row.release_date
    ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;

  const highActivityBonus = currentPlayers >= 10000 && momentum >= 0.03
    ? 10
    : currentPlayers >= 5000 && momentum >= 0.04
      ? 7
      : currentPlayers >= 1500 && momentum >= 0.05
        ? 4
        : 0;
  const breakoutBonus = momentum >= 0.2 && currentPlayers >= 500
    ? 8
    : momentum >= 0.3 && currentPlayers >= 250
      ? 5
      : 0;
  const lowActivityPenalty = ageDays > 30 && currentPlayers < 500
    ? 18
    : ageDays > 14 && currentPlayers < 250
      ? 10
      : 0;

  return base + highActivityBonus + breakoutBonus - lowActivityPenalty;
}

function preferHomepageTrendingSignalPool(rows: GameRow[], desiredCount: number): GameRow[] {
  const premiumPool = rows.filter((row) => {
    const currentPlayers = row.current_players ?? 0;
    const momentum = row.momentum ?? 0;
    const qualityScore = confidenceWeightedScore(row);
    const ageDays = row.release_date
      ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
      : Number.POSITIVE_INFINITY;

    return (row.is_trending_manual ?? false)
      || isPremiumTrendingCandidate(row)
      || ((row.trending ?? false) && currentPlayers >= 10000 && momentum >= 0.04 && qualityScore >= 74)
      || (ageDays <= 21 && currentPlayers >= 120 && momentum >= 0.08 && qualityScore >= 78)
      || (ageDays <= 60 && currentPlayers >= 220 && momentum >= 0.08 && qualityScore >= 76);
  });
  if (premiumPool.length >= Math.min(desiredCount, 12)) {
    return premiumPool;
  }

  const strongPool = rows.filter((row) => {
    const currentPlayers = row.current_players ?? 0;
    const momentum = row.momentum ?? 0;
    const qualityScore = confidenceWeightedScore(row);
    const ageDays = row.release_date
      ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
      : Number.POSITIVE_INFINITY;

    return (row.is_trending_manual ?? false)
      || isAcceptableTrendingCandidate(row)
      || ((row.trending ?? false) && currentPlayers >= 7000 && momentum >= 0.04 && qualityScore >= 72)
      || (ageDays <= 45 && currentPlayers >= 100 && momentum >= 0.05 && qualityScore >= 76)
      || (ageDays <= 120 && currentPlayers >= 150 && momentum >= 0.05 && qualityScore >= 74);
  });
  if (strongPool.length >= desiredCount) {
    return strongPool;
  }

  return rows;
}

function isHomepageTrendingDisplayGame(row: GameRow): boolean {
  const qualityScore = confidenceWeightedScore(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;

  return isPremiumTrendingCandidate(row)
    || (((row.trending ?? false) || hasBrowseTrendingSignal(row)) && currentPlayers >= 10000 && momentum >= 0.04 && qualityScore >= 74)
    || (momentum >= 0.14 && currentPlayers >= 250 && qualityScore >= 76);
}

function isHomepageTrendingFallbackDisplayGame(row: GameRow): boolean {
  const qualityScore = confidenceWeightedScore(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;

  return isAcceptableTrendingCandidate(row)
    || (((row.trending ?? false) || hasBrowseTrendingSignal(row)) && currentPlayers >= 7000 && momentum >= 0.04 && qualityScore >= 72)
    || (momentum >= 0.08 && currentPlayers >= 175 && qualityScore >= 74);
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
  const supabase = getPublicSupabase();

  // Step 1: Manually featured games (editorial priority) — with 36mo recency cap
  // FIX: Old evergreen manual picks were dominating hero. Now capped at 3 years.
  // RULE: Hero sourced from is_featured_manual flag, NEVER from trending flag
  const manualCutoff = monthsAgoISO(36);
  const today = new Date().toISOString().slice(0, 10);
  const { data: manualFeatured } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .eq("is_featured_manual", true)
    .not("header_image", "is", null)
    .neq("header_image", "")
    .gte("score", 72)
    .gt("score", 0)
    .gte("release_date", manualCutoff)
    .lte("release_date", today)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(4) as { data: GameRow[] | null }; // Reduced from 6 to 4 to allow more auto-selected games

  // Step 2: Auto-selected recent high-quality games with header art
  const cutoff24 = monthsAgoISO(24);
  const cutoff36 = monthsAgoISO(36);
  const cutoff60 = monthsAgoISO(60);

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
      .gte("score", 76)
      .gt("score", 0)
      .gte("confidence", 0.5)
      .gte("review_count", 5000)
      .gte("release_date", cutoff36)
      .lte("release_date", today)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(40) as { data: GameRow[] | null };
    autoPool = wider.data;
  }

  // Last resort: widen to 60mo
  if (!autoPool || autoPool.length < 4) {
    const widest = await supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("header_image", "is", null)
      .neq("header_image", "")
      .gte("score", 76)
      .gt("score", 0)
      .gte("confidence", 0.5)
      .gte("review_count", 5000)
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
    hasUsableCardImage(r) &&
    !isFutureDate(r.release_date)
  );
  const qualityFiltered = ready.filter((r) => isQualityGame(r, "hero"));
  const heroFiltered = qualityFiltered.filter(isHomepageHeroAutoCandidate);

  heroFiltered.sort((a, b) => getHomepageHeroScore(b) - getHomepageHeroScore(a));

  // Genre diversity: max 2 per primary genre
  const diversified = applyGenreDiversity(heroFiltered, limit, 2);

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
  const supabase = getPublicSupabase();

  // Step 1: Load manually-flagged trending seeds (these get priority slots in the rail)
  const { data: flagged, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .eq("is_trending_manual", true)
    .limit(40) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  // Step 2: Always load a scoring-based pool to fill remaining slots
  // Over-fetch 4× limit so quality filtering + dedup still leaves enough
  const cutoff4yr = monthsAgoISO(120);
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
    .order("is_trending_manual", { ascending: false, nullsFirst: false })
    .order("trending", { ascending: false, nullsFirst: false })
    .order("current_players", { ascending: false, nullsFirst: false })
    .order("momentum", { ascending: false, nullsFirst: false })
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(Math.max(limit * 12, 400)) as { data: GameRow[] | null };

  // Step 3: Build combined candidate set — flagged first, then scored pool
  const flaggedIds = new Set((flagged ?? []).map((g) => g.id));
  const poolDeduped = (pool ?? []).filter((g) => !flaggedIds.has(g.id));
  const allCandidates = deduplicateBySteamAppId([...(flagged ?? []), ...poolDeduped]);

  // Step 4: Quality filter + surface readiness + public safety + media readiness
  const qualityFiltered = filterQualityGames(allCandidates, {
    section: "trending",
    minResults: 4,
    allowReadinessFallback: homepageOnly,
  });
  const readyFiltered = qualityFiltered.filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );

  // Step 5: Apply recency gate (graduated) — but only for homepage
  let recencyFiltered: GameRow[];
  if (homepageOnly) {
    const desiredCount = Math.min(limit, HOMEPAGE_RAIL_TARGET);
    recencyFiltered = readyFiltered.filter(isHomepageTrendingEligible);
    if (recencyFiltered.length < desiredCount) {
      recencyFiltered = readyFiltered.filter((r) => isRecentEnoughForHome(r, HOMEPAGE_TRENDING_FALLBACK_MONTHS));
    }
    if (recencyFiltered.length < desiredCount) {
      recencyFiltered = readyFiltered.filter((r) => isRecentEnoughForHome(r, HOMEPAGE_TRENDING_LAST_RESORT_MONTHS));
    }
    if (recencyFiltered.length < desiredCount) recencyFiltered = readyFiltered;

    recencyFiltered = preferTrendingMomentumPool(recencyFiltered, desiredCount);
    const premiumRanked = recencyFiltered.filter(isPremiumTrendingCandidate);
    const acceptableRanked = recencyFiltered.filter(isAcceptableTrendingCandidate);
    if (premiumRanked.length >= HOMEPAGE_PRIORITY_FLOOR) {
      recencyFiltered = prioritizeById(premiumRanked, recencyFiltered, recencyFiltered.length);
    } else if (acceptableRanked.length >= HOMEPAGE_PRIORITY_FLOOR) {
      recencyFiltered = prioritizeById(acceptableRanked, recencyFiltered, recencyFiltered.length);
    }
    recencyFiltered = preferHomepageTrendingQualityPool(recencyFiltered, desiredCount);
    recencyFiltered = preferHomepageTrendingSignalPool(recencyFiltered, desiredCount);

    const strongDisplayPool = recencyFiltered.filter(isHomepageTrendingDisplayGame);
    const fallbackDisplayPool = recencyFiltered.filter(isHomepageTrendingFallbackDisplayGame);
    if (strongDisplayPool.length >= desiredCount) {
      recencyFiltered = strongDisplayPool;
    } else if (fallbackDisplayPool.length >= desiredCount) {
      recencyFiltered = fallbackDisplayPool;
    } else if (strongDisplayPool.length >= HOMEPAGE_PRIORITY_FLOOR) {
      recencyFiltered = prioritizeById(strongDisplayPool, recencyFiltered, recencyFiltered.length);
    } else if (fallbackDisplayPool.length >= HOMEPAGE_PRIORITY_FLOOR) {
      recencyFiltered = prioritizeById(fallbackDisplayPool, recencyFiltered, recencyFiltered.length);
    }
  } else {
    recencyFiltered = readyFiltered;
  }

  // Step 6: Rank by trending score — flagged games get a fixed boost
  const ranked = [...recencyFiltered].sort((a, b) => {
    // Flagged games float to the top regardless of raw score
    const aFlagged = a.is_trending_manual ? 1 : 0;
    const bFlagged = b.is_trending_manual ? 1 : 0;
    if (bFlagged !== aFlagged) return bFlagged - aFlagged;

    return getHomepageTrendingScore(b) - getHomepageTrendingScore(a);
  });

  if (homepageOnly) {
    const premiumRanked = ranked.filter(isPremiumTrendingCandidate);
    const acceptableRanked = ranked.filter(isAcceptableTrendingCandidate);
    if (premiumRanked.length >= HOMEPAGE_PRIORITY_FLOOR) {
      ranked.splice(0, ranked.length, ...prioritizeById(premiumRanked, ranked, ranked.length));
    } else if (acceptableRanked.length >= HOMEPAGE_PRIORITY_FLOOR) {
      ranked.splice(0, ranked.length, ...prioritizeById(acceptableRanked, ranked, ranked.length));
    }
  }

  // Genre diversity: max 3 per primary genre
  const diversified = applyGenreDiversity(ranked, limit, 3);

  const final = diversified.filter((row) => {
    if ((row as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (row.verdict_label === "COMING SOON") return false;
    if (!row.release_date || isFutureDate(row.release_date)) return false;
    return true;
  });

  return final.map(mapGameRow);
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

export function getHomepageRecommendationScore(row: GameRow): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const ageDays = row.release_date
    ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;
  const recencyBonus = ageDays <= 180
    ? 14
    : ageDays <= 365
      ? 10
      : ageDays <= 730
        ? 6
        : ageDays <= 1095
          ? 3
          : 0;
  const activityBonus = currentPlayers >= 5000
    ? 8
    : currentPlayers >= 1500
      ? 5
      : currentPlayers >= 250
        ? 2
        : 0;
  const scaleBonus = evidenceReviewCount >= 50000
    ? 6
    : evidenceReviewCount >= 10000
      ? 3
      : 0;

  return qualityScore + recencyBonus + activityBonus + scaleBonus;
}

export function isHomepageRecommendationEligible(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const ageDays = row.release_date
    ? (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;

  if (evidenceReviewCount >= 50000 || currentPlayers >= 2500) {
    return true;
  }

  if (evidenceReviewCount >= 10000 && currentPlayers >= 250) {
    return true;
  }

  if (evidenceReviewCount >= 5000 && currentPlayers >= 500) {
    return true;
  }

  if (hasStrongCriticEvidence(row)) {
    return currentPlayers >= 250
      || evidenceReviewCount >= 5000
      || (ageDays <= 45 && evidenceReviewCount >= 1500 && currentPlayers >= 100);
  }

  return evidenceReviewCount >= 2500 && currentPlayers >= 1000;
}

export async function fetchNewReleases(limit = 20): Promise<Game[]> {
  const supabase = getPublicSupabase();
  const fetchLimit = limit * 6;

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

  // Surface readiness + public safety + media readiness gate
  const ready = (data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  );
  const filtered = filterQualityGames(ready, { section: "newReleases", minResults: 4, allowReadinessFallback: false });

  // Exclude games that will be converted to COMING SOON by mapper:
  // - is_provisional = true (unless well-reviewed)
  // - verdict_label = 'COMING SOON'
  // - future release date
  // - 0 reviews AND not a recent release (>14 days old)
  const JUST_RELEASED_DAYS = 14;
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(today + "T00:00:00").getTime();
  
  const final = deduplicateBySteamAppId(filtered.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional && r.review_count < 50) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (isFutureDate(r.release_date)) return false;
    
    // Exclude 0-review games that are past the "just released" window
    const reviewCount = r.review_count ?? 0;
    if (reviewCount === 0 && r.release_date) {
      const normalizedReleaseDate = /^\d{4}-\d{2}-\d{2}$/.test(r.release_date)
        ? `${r.release_date}T00:00:00Z`
        : /^\d{4}$/.test(r.release_date)
          ? `${r.release_date}-01-01T00:00:00Z`
          : r.release_date;
      const releaseMs = new Date(normalizedReleaseDate).getTime();
      if (Number.isNaN(releaseMs)) return false;
      const daysSinceRelease = (todayMs - releaseMs) / (1000 * 60 * 60 * 24);
      if (daysSinceRelease > JUST_RELEASED_DAYS) return false;
    }
    
    return true;
  })).sort((a, b) => {
    const releaseDiff = (b.release_date ?? "").localeCompare(a.release_date ?? "");
    if (releaseDiff !== 0) return releaseDiff;
    const launchDiff = getNewReleaseDiscoveryScore(b) - getNewReleaseDiscoveryScore(a);
    if (launchDiff !== 0) return launchDiff;
    const reviewDiff = getEvidenceReviewCount(b) - getEvidenceReviewCount(a);
    if (reviewDiff !== 0) return reviewDiff;
    return (b.current_players ?? 0) - (a.current_players ?? 0);
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
  const supabase = getPublicSupabase();
  const fetchLimit = limit * 8;

  const { data, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  const ready = deduplicateBySteamAppId((data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  ));
  const filtered = filterQualityGames(ready, { section: "topRated", minResults: 4, allowReadinessFallback: false });

  // Exclude provisional / coming soon
  const clean = filtered.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (isFutureDate(r.release_date)) return false;
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
  const supabase = getPublicSupabase();
  const fetchLimit = limit * 8;
  const cutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_MONTHS);

  const { data, error } = await supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("release_date", "is", null)
    .gte("release_date", cutoff)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  let ready = deduplicateBySteamAppId((data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  ));
  let filtered = filterQualityGames(ready, { section: "topRated", minResults: 4, allowReadinessFallback: false });

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
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("confidence", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

    if (!fallback.error && fallback.data) {
      ready = deduplicateBySteamAppId(fallback.data.filter((r) =>
        isSurfaceReady(r, "homepageRail") &&
        isPublicSafeGame(r) &&
        hasUsableCardImage(r)
      ));
      filtered = filterQualityGames(ready, { section: "topRated", minResults: 4, allowReadinessFallback: false });
    }
  }

  // Exclude provisional / coming soon
  filtered = filtered.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (isFutureDate(r.release_date)) return false;
    return true;
  });

  const homepageEligible = filtered.filter(isHomepageTopRatedEligible);
  if (homepageEligible.length > 0) {
    filtered = homepageEligible;
  }

  filtered = preferHomepageTopRatedPool(filtered, limit);
  filtered.sort((a, b) => {
    const tierDiff = getHomepageTopRatedEvidenceTier(b) - getHomepageTopRatedEvidenceTier(a);
    if (tierDiff !== 0) return tierDiff;
    return getHomepageTopRatedScore(b) - getHomepageTopRatedScore(a);
  });

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
  const supabase = getPublicSupabase();
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
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  let ready = deduplicateBySteamAppId((data ?? []).filter((r) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r)
  ));

  let clean = ready.filter((r) => {
    if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
    if (r.verdict_label === "COMING SOON") return false;
    if (isFutureDate(r.release_date)) return false;
    return true;
  });

  let qualityFiltered = filterQualityGames(clean, {
    section: "recommendations",
    minResults: 4,
    allowReadinessFallback: false,
  });

  if (qualityFiltered.length < limit) {
    const fallbackCutoff = monthsAgoISO(HOMEPAGE_REC_FALLBACK_MONTHS);
    const fallback = await supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("release_date", "is", null)
      .gte("release_date", fallbackCutoff)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .gte("score", 75)
      .gte("review_count", 50)
      .gte("confidence", 0.4)
      .not("cover_image", "is", null)
      .neq("cover_image", "")
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(fetchLimit) as { data: GameRow[] | null; error: unknown };

    if (!fallback.error && fallback.data) {
      ready = deduplicateBySteamAppId(fallback.data.filter((r) =>
        isSurfaceReady(r, "homepageRail") &&
        isPublicSafeGame(r) &&
        hasUsableCardImage(r)
      ));
      clean = ready.filter((r) => {
        if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
        if (r.verdict_label === "COMING SOON") return false;
        if (isFutureDate(r.release_date)) return false;
        return true;
      });
      qualityFiltered = filterQualityGames(clean, {
        section: "recommendations",
        minResults: 4,
        allowReadinessFallback: false,
      });
    }
  }

  const homepageEligible = qualityFiltered.filter(isHomepageRecommendationEligible);
  if (homepageEligible.length > 0) {
    qualityFiltered = homepageEligible;
  }

  qualityFiltered.sort((a, b) => getHomepageRecommendationScore(b) - getHomepageRecommendationScore(a));

  // Genre diversity: max 1 per genre for anonymous recs (broad discovery)
  const diversified = applyGenreDiversity(qualityFiltered, limit, 1);

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

export interface HomepageAnticipatedGame {
  rawgId: number;
  slug: string;
  name: string;
  released: string | null;
  tba: boolean;
  image: string | null;
  added: number;
  toplay: number;
  genres: string[];
}

export const HOMEPAGE_REVALIDATE_SECONDS = 60;
export const HOMEPAGE_API_CACHE_CONTROL = `s-maxage=${HOMEPAGE_REVALIDATE_SECONDS}, stale-while-revalidate=300`;

export const EMPTY_HOMEPAGE_DATA: HomepageData = {
  hero: [],
  trending: [],
  topRated: [],
  newReleases: [],
  deals: [],
  recommendations: [],
};

function mapHomepageAnticipatedItem(item: RawgListItem): HomepageAnticipatedGame {
  return {
    rawgId: item.id,
    slug: item.slug,
    name: item.name,
    released: item.released,
    tba: item.tba,
    image: item.background_image,
    added: item.added,
    toplay: item.added_by_status?.toplay ?? 0,
    genres: (item.genres ?? []).map((genre) => genre.name),
  };
}

async function fetchHomepageMostAnticipated(limit = 12): Promise<HomepageAnticipatedGame[]> {
  const { getRawgBestOfYear } = await import("@/lib/external/rawg");
  const response = await getRawgBestOfYear(1, Math.max(limit * 2, 24));
  const today = new Date().toISOString().slice(0, 10);
  const mapped = response.results
    .map(mapHomepageAnticipatedItem)
    .filter((item) => item.image);

  let items = mapped.filter((item) => item.tba || !item.released || item.released >= today);
  if (items.length < limit) {
    items = mapped;
  }

  items = items.slice(0, limit);
  if (items.length === 0) {
    return [];
  }

  try {
    const supabase = getPublicSupabase();
    const rawgIds = items.map((item) => item.rawgId).filter(Boolean);
    if (rawgIds.length > 0) {
      const { data: dbGames } = await supabase
        .from("games")
        .select("rawg_id, slug")
        .in("rawg_id", rawgIds);

      if (dbGames && dbGames.length > 0) {
        const slugMap = new Map<number, string>();
        for (const game of dbGames) {
          if (game.rawg_id) {
            slugMap.set(game.rawg_id, game.slug);
          }
        }

        items = items.map((item) => ({
          ...item,
          slug: slugMap.get(item.rawgId) ?? item.slug,
        }));
      }
    }
  } catch {
    return items;
  }

  return items;
}

const getCachedHomepageData = unstable_cache(
  async () => fetchHomepageData(),
  ["homepage-data-v5"],
  { revalidate: HOMEPAGE_REVALIDATE_SECONDS }
);

const getCachedHomepageMostAnticipated = unstable_cache(
  async () => fetchHomepageMostAnticipated(),
  ["homepage-most-anticipated"],
  { revalidate: 3600 }
);

export async function loadHomepageData(): Promise<HomepageData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return EMPTY_HOMEPAGE_DATA;
  }

  try {
    return await getCachedHomepageData();
  } catch {
    return EMPTY_HOMEPAGE_DATA;
  }
}

export async function loadHomepageMostAnticipated(): Promise<HomepageAnticipatedGame[]> {
  if (!process.env.RAWG_API_KEY) {
    return [];
  }

  try {
    return await getCachedHomepageMostAnticipated();
  } catch {
    return [];
  }
}

function resolveHomepageSection<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
  if (result.status === "fulfilled") {
    return result.value;
  }

  console.error(`[homepage] Failed to load ${label}:`, result.reason);
  return fallback;
}

function isHomepageTrendingFallbackCandidate(game: Game): boolean {
  const currentPlayers = game.currentPlayers ?? 0;
  const momentum = game.momentum ?? 0;
  const reviewCount = game.reviewCount ?? 0;
  const score = game.verdictScore ?? game.score ?? 0;
  const today = new Date().toISOString().slice(0, 10);

  if (!game.coverImage || !game.releaseDate || game.releaseDate > today) {
    return false;
  }

  if (game.verdictLabel === "COMING SOON") {
    return false;
  }

  return Boolean(game.isTrendingManual)
    || Boolean(game.trending)
    || (momentum >= 0.05 && (currentPlayers >= 100 || reviewCount >= 150))
    || currentPlayers >= 10000
    || (currentPlayers >= 3000 && score >= 80)
    || (reviewCount >= 10000 && currentPlayers >= 250);
}

function getHomepageTrendingFallbackScore(game: Game): number {
  const currentPlayers = game.currentPlayers ?? 0;
  const momentum = game.momentum ?? 0;
  const reviewCount = game.reviewCount ?? 0;
  const score = game.verdictScore ?? game.score ?? 0;

  return (game.isTrendingManual ? 500 : 0)
    + (game.trending ? 120 : 0)
    + Math.min(120, Math.log10(currentPlayers + 1) * 30)
    + Math.min(100, momentum * 1000)
    + Math.min(60, Math.log10(reviewCount + 1) * 15)
    + score;
}

function buildHomepageTrendingFallback(pools: Game[][], limit: number): Game[] {
  const seenIds = new Set<string>();
  const merged: Game[] = [];

  for (const pool of pools) {
    for (const game of pool) {
      if (seenIds.has(game.id)) {
        continue;
      }

      seenIds.add(game.id);
      merged.push(game);
    }
  }

  return merged
    .filter(isHomepageTrendingFallbackCandidate)
    .sort((left, right) => getHomepageTrendingFallbackScore(right) - getHomepageTrendingFallbackScore(left))
    .slice(0, limit);
}

function isReservedHomepageTopRatedGame(game: Game): boolean {
  const reviewCount = game.reviewCount ?? 0;
  const currentPlayers = game.currentPlayers ?? 0;
  const hasStrongCriticEvidence = (game.igdbRating ?? 0) >= 88 || (game.rawgMetacritic ?? 0) >= 88;

  return hasStrongCriticEvidence
    || reviewCount >= 50000
    || (reviewCount >= 10000 && currentPlayers >= 100)
    || (reviewCount >= 5000 && currentPlayers >= 250)
    || (reviewCount >= 2500 && currentPlayers >= 500);
}

export async function fetchHomepageData(): Promise<HomepageData> {
  // Fetch all sections in parallel — each overfetches for dedup headroom
  const [heroResult, trendingPrimaryResult, topRatedResult, newReleasesResult, dealsResult, recsResult] = await Promise.allSettled([
    fetchHeroCandidates(HOMEPAGE_HERO_TARGET * 4),
    fetchTrendingGames(HOMEPAGE_RAIL_TARGET * 2, true),
    fetchHomepageTopRated(HOMEPAGE_RAIL_TARGET * 2),
    fetchNewReleases(HOMEPAGE_RAIL_TARGET * 2),
    fetchDeals(),
    fetchHomepageRecommendations(HOMEPAGE_RAIL_TARGET * 2),
  ]);

  const heroRaw = resolveHomepageSection(heroResult, "hero rail", [] as Game[]);
  let trendingRaw = resolveHomepageSection(trendingPrimaryResult, "trending rail", [] as Game[]);
  const topRatedRaw = resolveHomepageSection(topRatedResult, "top rated rail", [] as Game[]);
  const newReleasesRaw = resolveHomepageSection(newReleasesResult, "new releases rail", [] as Game[]);
  const deals = resolveHomepageSection(dealsResult, "deals rail", [] as GXDeal[]);
  const recsRaw = resolveHomepageSection(recsResult, "recommendations rail", [] as Game[]);

  if (trendingRaw.length === 0) {
    try {
      trendingRaw = await fetchTrendingGames(HOMEPAGE_RAIL_TARGET * 2, false);
    } catch (error) {
      console.error("[homepage] Failed to load trending rail fallback:", error);
    }
  }

  if (trendingRaw.length === 0) {
    trendingRaw = buildHomepageTrendingFallback([
      newReleasesRaw,
      recsRaw,
      topRatedRaw,
    ], HOMEPAGE_RAIL_TARGET * 2);
  }

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

  const reservedTopRatedIds = new Set(
    topRatedRaw
      .filter(isReservedHomepageTopRatedGame)
      .slice(0, HOMEPAGE_TOP_RATED_RESERVED_TARGET)
      .map((game) => game.id)
  );
  const trendingPool = trendingRaw.filter((game) => !reservedTopRatedIds.has(game.id));
  const trendingCandidates = prioritizeById(trendingPool, trendingRaw, trendingRaw.length);

  // Claim in priority order
  const hero = claimSlots(heroRaw, HOMEPAGE_HERO_TARGET);
  const trending = claimSlots(trendingCandidates, HOMEPAGE_RAIL_TARGET);
  const topRatedClaimed = claimSlots(topRatedRaw, HOMEPAGE_RAIL_TARGET);
  const topRatedPremium = topRatedClaimed.filter(isReservedHomepageTopRatedGame);
  const topRated = topRatedPremium.length >= HOMEPAGE_PRIORITY_FLOOR
    ? prioritizeById(topRatedPremium, topRatedClaimed, HOMEPAGE_RAIL_TARGET)
    : topRatedClaimed;
  const newReleases = claimSlots(newReleasesRaw, HOMEPAGE_RAIL_TARGET);
  const recommendations = claimSlots(recsRaw, HOMEPAGE_RAIL_TARGET);

  return { hero, trending, topRated, newReleases, deals, recommendations };
}

function prioritizeById<T extends { id: string }>(primary: T[], fallback: T[], limit: number): T[] {
  const primaryIds = new Set(primary.map((item) => item.id));
  return [...primary, ...fallback.filter((item) => !primaryIds.has(item.id))].slice(0, limit);
}
