import { createHomepageSlots } from '@/lib/services/homepage-slots';
import { getFreshPlayerSignals, hasBrowseTrendingSignal, isPremiumTrendingCandidate } from '@/lib/utils/trending';
import { homepageReleaseWindow, selectHomepageNewReleases } from '@/lib/services/homepage-releases';
import { matchReviewedCatalogueRelease, matchReviewedPendingCatalogueRelease } from './reviewed-catalogue-releases';
/**
 * VERDICT.GAMES — Homepage Service Layer
 *
 * Shared game-fetching logic used by both the /api/homepage aggregator
 * and the individual /api/games/* routes. No internal HTTP calls —
 * hits Supabase directly for minimal latency.
 *
 * ─── Section Contracts ───────────────────────────────────────────
 * Hero:          Editorial + high-quality, visually stunning games
 * Trending:      Observed growth, player activity, established activity and editorial picks
 * Top Rated:     Confidence-weighted best-scored recent games
 * New Releases:  Card-ready recently released games (newest first)
 * Upcoming:      Chronological upcoming/confirmed releases
 * Recently Added:Newly ingested games that pass readiness
 * Recommendations:Anonymous high-quality discovery (homepage)
 *
 * ─── Invariants ──────────────────────────────────────────────────
 * • Quality scoring ≠ surface readiness (never conflated)
 * • Every public rail output passes isSurfaceReady('homepageRail')
 * • Shared homepage rails prefer unique appearances and enforce per-rail repeat budgets.
 * • Hero/Featured is NEVER derived from trending. Only from is_featured_manual + auto pool.
 */

import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "@/lib/supabase/public";
import { readCachedUpcomingSnapshot } from '@/lib/services/upcoming-snapshot';
import { readHomepageReleaseRanking } from '@/lib/services/community-ranking';
import {hasEarlyAccessSignal,hasUnreleasedStatus,hasKnownFullRelease,hasUnavailableStatus} from '@/lib/utils/release-status';
import { isPrimaryDiscoveryGame } from '@/lib/utils/discovery';
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { admitCataloguePayload, coalesceCatalogueRead, readCachedCatalogue } from '@/lib/db/cached-catalogue';
import { measureHomepagePhase, startHomepagePhase } from '@/lib/services/homepage-timing';
import { boundedHomepageRead, currentHomepageSignal } from '@/lib/services/homepage-budget';
import { isFutureDate } from "@/lib/utils";
import {
  filterQualityGames,
  confidenceWeightedScore,
  getCriticSourceCount,
  getEvidenceReviewCount,
  hasStrongCriticEvidence,
  isQualityGame,
  isSurfaceReady,
} from "@/lib/utils/quality";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { diversifyRecommendations, removeRecommendationVariants } from '@/lib/utils/recommendation-selection';
import type { ReleaseTiming } from '@/lib/utils/release-timing';
import { getHomepageHeroScore, hasRecentHeroActivity, hasWideHeroArtwork, isHomepageHeroAutoCandidate, selectHeroDiscoveryCandidates } from "@/lib/utils/homepageHero";
import { isProviderHeroArtwork, reviewedHeroArtwork } from '@/lib/utils/artwork-policy.mjs';
import {
  ESTABLISHED_STEAM_REVIEWS, PLAYER_MOMENTUM_LOOKBACK_MS, PLAYER_POPULARITY_MINIMUM,
  selectHomepagePopularity,
} from "@/lib/services/homepage-popularity";
import type { GameRow } from "@/lib/supabase/types";
import type { Game, GXDeal } from "@/lib/types";

/* ═══════════════════════════════════════════════════
   Homepage Recency Helpers
   Keep home feeling current — old classics belong on
   explore/search/top-rated pages, not the homepage.
   ═══════════════════════════════════════════════════ */

const HOMEPAGE_TRENDING_MONTHS = 60;
const HOMEPAGE_TOP_RATED_MONTHS = 24;
const HOMEPAGE_TOP_RATED_FALLBACK_MONTHS = 60; // Widened from 36 to 60
const HOMEPAGE_TOP_RATED_EVERGREEN_MONTHS = 180;
const HOMEPAGE_HERO_TARGET = 6;
const HOMEPAGE_RAIL_TARGET = 20;
const HOMEPAGE_MOST_ANTICIPATED_TARGET = 20;
const HOMEPAGE_PRIORITY_FLOOR = 8;
const HOMEPAGE_HERO_FETCH_TARGET = 12;
const HOMEPAGE_SECTION_FETCH_TARGET = HOMEPAGE_RAIL_TARGET * 5;
const HOMEPAGE_TOP_RATED_FETCH_TARGET = 180;
const HOMEPAGE_TOP_RATED_EVERGREEN_FETCH_TARGET = 240;
const HOMEPAGE_QUERY_MIN_ROWS = 60;
const HOMEPAGE_QUERY_MAX_ROWS = 120;

function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function isRecentEnoughForHome(row: GameRow, months: number): boolean {
  if (!row.release_date) return false;
  return row.release_date >= monthsAgoISO(months);
}

function getHomepageReleaseAgeDays(value: string | null | undefined): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00Z`
    : /^\d{4}$/.test(value)
      ? `${value}-01-01T00:00:00Z`
      : value;
  const timestamp = new Date(normalizedValue).getTime();

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return (Date.now() - timestamp) / 86400000;
}

function getHomepageQueryFetchLimit(limit: number, multiplier = 4): number {
  return Math.min(Math.max(limit * multiplier, HOMEPAGE_QUERY_MIN_ROWS), HOMEPAGE_QUERY_MAX_ROWS);
}

export function isHomepageTrendingEligible(row: GameRow): boolean {
  const currentPlayers = getFreshPlayerSignals(row).players;
  const momentum = getFreshPlayerSignals(row).momentum;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);
  const hasSharedTrendingSignal = hasBrowseTrendingSignal(row);

  if (row.is_trending_manual ?? false) {
    return true;
  }

  if (!hasSharedTrendingSignal) {
    return false;
  }

  if (ageDays > 365 * 4) {
    return ((row.trending ?? false) && currentPlayers >= 22000 && momentum >= 0.07)
      || (currentPlayers >= 26000 && momentum >= 0.08);
  }

  if (ageDays > 365 * 3) {
    return ((row.trending ?? false) && currentPlayers >= 17000 && momentum >= 0.06)
      || (currentPlayers >= 22000 && momentum >= 0.06);
  }

  if (isRecentEnoughForHome(row, HOMEPAGE_TRENDING_MONTHS)) {
    return true;
  }

  return ((row.trending ?? false) && currentPlayers >= 12000 && momentum >= 0.04)
    || (ageDays <= 730 && currentPlayers >= 8000 && momentum >= 0.05)
    || (currentPlayers >= 18000 && momentum >= 0.05)
    || (ageDays <= 365 * 3 && momentum >= 0.14 && currentPlayers >= 700);
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

export function getHomepageTopRatedScore(row: GameRow): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const criticSources = getCriticSourceCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const reviewScore = Math.min(14, Math.log10(evidenceReviewCount + 1) * 3.1);
  const activityScore = Math.min(16, Math.log10(currentPlayers + 1) * 4);
  const ageDays = getHomepageReleaseAgeDays(row.release_date);
  const recencyScore = ageDays <= 90
    ? 14
    : ageDays <= 180
      ? 10
    : ageDays <= 365
        ? 6
        : ageDays <= 730
          ? 2
          : 0;
  const criticBonus = criticSources >= 2 ? 4 : criticSources === 1 ? 1.5 : 0;
  const livePresenceBonus = currentPlayers >= 15000
    ? 14
    : currentPlayers >= 7000
      ? 10
      : currentPlayers >= 2500
        ? 6
        : currentPlayers >= 1000
          ? 3
          : 0;
  const lowPresencePenalty = ageDays > 365 && currentPlayers < 500
    ? 22
    : ageDays > 180 && currentPlayers < 750
      ? 14
      : ageDays > 90 && currentPlayers < 1000
        ? 8
        : 0;
  const scaleBonus = evidenceReviewCount >= 100000
    ? 8
    : evidenceReviewCount >= 50000
      ? 6
      : evidenceReviewCount >= 10000
        ? 3
        : 0;

  return qualityScore + reviewScore + activityScore + recencyScore + criticBonus + scaleBonus + livePresenceBonus - lowPresencePenalty;
}

function getHomepageTopRatedEvidenceTier(row: GameRow): number {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;

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

export function isHomepageTopRatedEligible(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);

  if (ageDays <= 120 && currentPlayers < 450 && evidenceReviewCount < 50000) {
    return false;
  }

  if (ageDays > 120 && ageDays <= 365 && currentPlayers < 650 && evidenceReviewCount < 100000) {
    return false;
  }

  if (ageDays > 365 && currentPlayers < 1000 && evidenceReviewCount < 200000) {
    return false;
  }

  if (evidenceReviewCount >= 300000) {
    return currentPlayers >= 500 || ageDays <= 60;
  }

  if (evidenceReviewCount >= 100000) {
    return currentPlayers >= (ageDays > 365 ? 1000 : ageDays > 120 ? 650 : 400)
      || ageDays <= 45;
  }

  if (evidenceReviewCount >= 50000) {
    return currentPlayers >= (ageDays > 365 ? 1400 : ageDays > 120 ? 850 : 500);
  }

  if (ageDays <= 120 && evidenceReviewCount >= 10000 && currentPlayers >= 500) {
    return true;
  }

  if (hasStrongCriticEvidence(row)) {
    return currentPlayers >= 2000
      || (ageDays <= 90 && evidenceReviewCount >= 15000 && currentPlayers >= 650)
      || (ageDays <= 45 && evidenceReviewCount >= 4000 && currentPlayers >= 250);
  }

  if (evidenceReviewCount >= 10000 && currentPlayers >= 750) {
    return true;
  }

  if (evidenceReviewCount >= 5000 && currentPlayers >= 1200) {
    return true;
  }

  if (ageDays <= 60 && evidenceReviewCount >= 5000 && currentPlayers >= 500) {
    return true;
  }

  return evidenceReviewCount >= 2500 && currentPlayers >= 1800;
}

function preferHomepageTopRatedPool(rows: GameRow[], desiredCount: number): GameRow[] {
  const elitePool = rows.filter((row) => confidenceWeightedScore(row) >= 88 && getHomepageTopRatedEvidenceTier(row) >= 2);
  if (elitePool.length >= desiredCount) {
    return elitePool;
  }

  const strongPool = rows.filter((row) => confidenceWeightedScore(row) >= 84 && getHomepageTopRatedEvidenceTier(row) >= 1);
  if (strongPool.length >= desiredCount) {
    return strongPool;
  }

  if (elitePool.length >= HOMEPAGE_PRIORITY_FLOOR) {
    return prioritizeById(elitePool, rows, rows.length);
  }

  if (strongPool.length >= HOMEPAGE_PRIORITY_FLOOR) {
    return prioritizeById(strongPool, rows, rows.length);
  }

  return rows;
}

export function isHomepageTopRatedEvergreenBackfillCandidate(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);

  if (!row.release_date || ageDays <= 365 || !isRecentEnoughForHome(row, HOMEPAGE_TOP_RATED_EVERGREEN_MONTHS) || verdictScore < 88) {
    return false;
  }

  if (evidenceReviewCount >= 300000) {
    return currentPlayers >= 500;
  }

  if (evidenceReviewCount >= 100000) {
    return currentPlayers >= 1000;
  }

  if (evidenceReviewCount >= 50000) {
    return currentPlayers >= 1500;
  }

  if (hasStrongCriticEvidence(row)) {
    return evidenceReviewCount >= 25000 && currentPlayers >= 3000;
  }

  return evidenceReviewCount >= 25000 && currentPlayers >= 2200;
}

function isHomepageHeroBackfillCandidate(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const momentum = getFreshPlayerSignals(row).momentum;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);

  if (!row.release_date || verdictScore < 80) return false;

  // An exceptional catalogue title may earn an evergreen slot based on
  // corroborated acclaim. Activity-based candidates need a recent sample.
  if (ageDays > 365 && verdictScore >= 90 && (row.confidence ?? 0) >= 0.7 &&
    (row.critic_source_count ?? 0) > 0 && (row.critic_score ?? 0) >= 85 &&
    evidenceReviewCount >= 50000) return true;
  if (!hasRecentHeroActivity(row) || currentPlayers < 2000) return false;

  if (ageDays <= 180) {
    return (hasStrongCriticEvidence(row) && verdictScore >= 82)
      || evidenceReviewCount >= 7500
      || currentPlayers >= 3000
      || momentum >= 0.05
      || (hasBrowseTrendingSignal(row) && momentum >= 0.03);
  }

  if (ageDays <= 365) {
    return (hasStrongCriticEvidence(row) && verdictScore >= 84)
      || evidenceReviewCount >= 15000
      || currentPlayers >= 5000
      || (currentPlayers >= 3000 && momentum >= 0.03);
  }

  return (hasStrongCriticEvidence(row) && verdictScore >= 86 && currentPlayers >= 5000)
    || evidenceReviewCount >= 50000
    || (currentPlayers >= 8000 && momentum >= 0.02);
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

const HERO_GAME_COLUMNS = GAME_CARD_COLUMNS_WITH_DESC + ',rawg_id,igdb_id';

export function mapHomepageHeroCard(row: GameRow): Game {
  const game = mapGameRow(row);
  // TVGS identifies this Steam app as Early Access. Its stored score remains canonical.
  if (row.steam_app_id === 3164500 && row.slug === 'schedule-i' && !row.release_status) {
    game.releaseStatus = 'early-access';
    game.description = 'Start a small operation in Hyland Point and build it into a criminal enterprise. Manage production and distribution alone or with friends.';
  }
  const reviewed = reviewedHeroArtwork({ slug: row.slug, igdbId: row.igdb_id, rawgId: row.rawg_id });
  if (!reviewed) return game;
  const alternate = [game.headerImage, reviewed.fallbackUrl].find(url =>
    url !== reviewed.url && url !== game.coverImage && isProviderHeroArtwork(url, row.steam_app_id ?? 0));
  return {
    ...game,
    headerImage: reviewed.url,
    heroArtworkFallback: alternate,
    heroArtworkMobileFocalPoint: reviewed.mobileFocalPoint,
    ...(row.slug === 'grand-theft-auto-vi' ? {
      description: 'A robbery gone wrong pulls Jason and Lucia into a criminal conspiracy that stretches from Vice City across Leonida.',
    } : {}),
  };
}

export async function fetchHeroCandidates(limit = 12): Promise<Game[]> {
  const supabase = getPublicSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const launchCutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  // Recent, well-supported releases must not require a multiplayer-scale
  // concurrent player count to earn a spotlight.
  const { data: freshReleases, error: freshError } = await measureHomepagePhase('database', () => supabase.from('games')
    .select(HERO_GAME_COLUMNS).gte('release_date', monthsAgoISO(6))
    .lte('release_date', today)
    .or(`and(score.gte.80,confidence.gte.0.5,review_count.gte.1000),and(release_status.eq.released,release_date.gte.${launchCutoff},or(verdict_score.gte.75,score.gte.75),critic_score.gte.85,review_count.gte.100)`)
    .not('header_image', 'is', null).neq('header_image', '')
    .order('release_date', { ascending: false }).limit(60));
  if (freshError) throw freshError;

  // Step 1: Manually featured games (editorial priority) — with 36mo recency cap
  // FIX: Old evergreen manual picks were dominating hero. Now capped at 3 years.
  // RULE: Hero sourced from is_featured_manual flag, NEVER from trending flag
  const manualCutoff = monthsAgoISO(36);
  const { data: manualFeatured, error: featuredError } = await measureHomepagePhase('database', () => supabase
    .from("games")
    .select(HERO_GAME_COLUMNS)
    .eq("is_featured_manual", true)
    .not("header_image", "is", null)
    .neq("header_image", "")
    .gte("score", 72)
    .gt("score", 0)
    .gte("release_date", manualCutoff)
    .lte("release_date", today)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(4)) as { data: GameRow[] | null; error: unknown };
  if (featuredError) throw featuredError;

  // Step 2: Auto-selected recent high-quality games with header art
  const cutoff24 = monthsAgoISO(24);
  const cutoff60 = monthsAgoISO(60);

  const initialPool = await measureHomepagePhase('database', () => supabase
    .from("games")
    .select(HERO_GAME_COLUMNS)
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
    .limit(40)) as { data: GameRow[] | null; error: unknown };
  if (initialPool.error) throw initialPool.error;
  const isReadyHero = (r: GameRow) =>
    isSurfaceReady(r, "homepageRail") &&
    isPublicSafeGame(r) &&
    hasUsableCardImage(r) &&
    hasWideHeroArtwork(r) &&
    !hasUnreleasedStatus(r) &&
    (!r.is_provisional || hasKnownFullRelease(r)) &&
    !isFutureDate(r.release_date);
  const finishSelection = startHomepagePhase('candidate_selection');
  const combined = deduplicateBySteamAppId([
    ...(freshReleases ?? []) as unknown as GameRow[], ...(manualFeatured ?? []), ...(initialPool.data ?? []),
  ]);
  const ready = combined.filter(isReadyHero);
  const qualityFiltered = ready.filter(r => isQualityGame(r, "hero"));
  const heroFiltered = qualityFiltered.filter(isHomepageHeroAutoCandidate);
  const byHeroScore = (a: GameRow, b: GameRow) => getHomepageHeroScore(b) - getHomepageHeroScore(a);
  let ranked = heroFiltered.sort(byHeroScore);

  const freshIds = new Set(((freshReleases ?? []) as unknown as GameRow[]).map(row => row.id));
  const freshSpotlights = ready.filter(row => freshIds.has(row.id) && !row.is_provisional && row.verdict_label !== 'COMING SOON')
    .filter(row => ((row.verdict_score ?? row.score ?? 0) >= 85 && getEvidenceReviewCount(row) >= 25000)
      || ((row.verdict_score ?? row.score ?? 0) >= 88 && hasStrongCriticEvidence(row) && getEvidenceReviewCount(row) >= 5000))
    .sort((a,b) => getHomepageHeroScore(b)-getHomepageHeroScore(a) || b.release_date!.localeCompare(a.release_date!))
    .slice(0, 4);
  ranked = prioritizeById(freshSpotlights, ranked, limit);

  if (ranked.length < Math.min(limit, HOMEPAGE_HERO_FETCH_TARGET)) {
    const rankedIds = new Set(ranked.map((row) => row.id));
    const backfill = qualityFiltered
      .filter((row) => !rankedIds.has(row.id))
      .filter(isHomepageHeroBackfillCandidate)
      .sort(byHeroScore);

    ranked = prioritizeById(ranked, backfill, limit);
  }

  finishSelection();

  // The raw 24-month pool can be full while the qualified hero is short.
  // Widen only in that case and keep the existing quality and player gates.
  if (ranked.length < Math.min(limit, HOMEPAGE_HERO_TARGET)) {
    try {
      const older = await boundedHomepageRead(1500, () => measureHomepagePhase('database', () => supabase
        .from("games")
        .select(HERO_GAME_COLUMNS)
        .not("header_image", "is", null)
        .neq("header_image", "")
        .gte("score", 76)
        .gte("confidence", 0.5)
        .gte("review_count", 5000)
        .or("current_players.gte.2000,and(critic_source_count.gte.1,critic_score.gte.85,review_count.gte.50000)")
        .gte("release_date", cutoff60)
        .lt("release_date", cutoff24)
        .order("verdict_score", { ascending: false, nullsFirst: false })
        .order("score", { ascending: false })
        .limit(40)));
      if (!older.error) {
        ranked = deduplicateBySteamAppId([
          ...ranked,
          ...((older.data ?? []) as unknown as GameRow[])
            .filter(isReadyHero)
            .filter(row => isQualityGame(row, "hero") &&
              (isHomepageHeroAutoCandidate(row) || isHomepageHeroBackfillCandidate(row)))
            .sort(byHeroScore),
        ]).slice(0, limit);
      }
    } catch {
      // A late or unavailable supplementary read leaves the qualified pool.
      currentHomepageSignal()?.throwIfAborted();
    }
  }

  // Genre diversity: max 2 per primary genre
  // Genre diversity is a preference, not a reason to leave a six-slide hero
  // half empty when the catalogue has enough otherwise-qualified games.
  const diversified = prioritizeById(applyGenreDiversity(ranked, limit, 2), ranked, limit);

  const released = diversified.map(mapHomepageHeroCard);
  // A confirmed, independently reviewed launch can qualify from catalogue
  // evidence when the third-party ranking snapshot is absent or slow.
  const verifiedLaunch = ready.filter(row => freshIds.has(row.id) && row.header_image !== row.cover_image
      && row.release_date! >= launchCutoff && hasKnownFullRelease(row) && !row.is_provisional
      && isPrimaryDiscoveryGame(row) && (row.verdict_score ?? row.score ?? 0) >= 75
      && (row.critic_score ?? 0) >= 85 && (row.critic_source_count ?? 0) >= 1 && (row.review_count ?? 0) >= 100)
    .sort((a, b) => getHomepageHeroScore(b) - getHomepageHeroScore(a))[0];
  const launch = verifiedLaunch && { ...mapHomepageHeroCard(verifiedLaunch), spotlightReason: "Recent Release" as const };
  const fallback = launch ? [launch, ...released.filter(game => game.id !== launch.id)].slice(0, limit) : released;
  try {
    return await boundedHomepageRead(2200, async () => {
      const [discovery,releaseRanking] = await measureHomepagePhase('provider_snapshot', () =>
        Promise.allSettled([readCachedUpcomingSnapshot(),readHomepageReleaseRanking()]));
      const snapshot=[...(discovery.status==='fulfilled'?discovery.value.results:[]),...(releaseRanking.status==='fulfilled'?releaseRanking.value?.results || []:[])];
      const upcoming = selectHeroDiscoveryCandidates(snapshot,today);
      if(!upcoming.length)return fallback;
      const {data,error} = await measureHomepagePhase('candidate_hydration', () =>
        measureHomepagePhase('database', () => supabase.from('games').select(HERO_GAME_COLUMNS+',igdb_summary,wikipedia_excerpt')
          .in('rawg_id',upcoming.map(item=>item.id)).abortSignal(AbortSignal.timeout(3000))));
      if(error)return fallback;
      const rows=(data || []) as unknown as GameRow[];
      const spotlights=upcoming.flatMap(item=>{
        const row=rows.find(row=>row.rawg_id===item.id);
        if (!row || row.release_date !== item.released || !isPublicSafeGame(row) || !isPrimaryDiscoveryGame(row)) return [];
        const isRecentLaunch = item.released! <= today;
        const verifiedTiming = matchReviewedPendingCatalogueRelease(row)?.timing;
        if (isRecentLaunch
          ? hasUnreleasedStatus(row) || hasEarlyAccessSignal(row) || row.is_provisional
            || !hasKnownFullRelease(row) && !matchReviewedCatalogueRelease(row)
          : hasKnownFullRelease(row) || hasUnavailableStatus(row)
            || verifiedTiming?.precision !== 'day' || verifiedTiming.value !== item.released) return [];
        const game=mapHomepageHeroCard(row);
        const header = hasWideHeroArtwork(row) ? game.headerImage : item.background_image;
        if (!header || header === game.coverImage || !isProviderHeroArtwork(header, row.steam_app_id ?? 0)) return [];
        return [{ ...game, headerImage: header, spotlightReason: isRecentLaunch ? "Recent Release" as const : "Upcoming" as const }];
      });
      const recent = spotlights.find(game => game.releaseDate <= today && !game.isProvisional) ?? launch;
      const forthcoming = spotlights.find(game => game.releaseDate > today && game.isProvisional);
      const spotlightIds = new Set([recent?.id, forthcoming?.id]);
      const otherReleased = released.filter(game => !spotlightIds.has(game.id));
      return [
        ...(recent ? [recent] : otherReleased.splice(0, 1)),
        ...(forthcoming ? [forthcoming] : []),
        ...otherReleased,
      ].slice(0, limit);
    });
  } catch { return fallback; }
}

/* ═══════════════════════════════════════════════════
   Trending — CONTRACT
   ─────────────────────────────────────────────────
   Purpose: Bounded input pools for the evidence-based homepage rail.
   Candidate selection and evidence windows live in homepage-popularity.
   ═══════════════════════════════════════════════════ */

export async function fetchHomepageTrendingCandidates(): Promise<GameRow[]> {
  const supabase = getPublicSupabase();
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const oldestObservation = new Date(now - PLAYER_MOMENTUM_LOOKBACK_MS).toISOString();
  const latestObservation = new Date(now).toISOString();
  const base = () => supabase.from("games").select(GAME_CARD_COLUMNS_WITH_DESC)
    .lte("release_date", today).not("cover_image", "is", null).neq("cover_image", "");

  const activity = await measureHomepagePhase('database', () => base()
    .not("steam_app_id", "is", null)
    .gte("players_updated_at", oldestObservation).lte("players_updated_at", latestObservation)
    .gte("current_players", 100)
    .or("momentum.gte.0.0391,current_players.gte." + PLAYER_POPULARITY_MINIMUM)
    .order("players_updated_at", { ascending: false, nullsFirst: false })
    .order("current_players", { ascending: false, nullsFirst: false })
    .order("id").limit(100));
  if (activity.error) throw activity.error;

  const established = await measureHomepagePhase('database', () => base()
    .not("steam_app_id", "is", null).gte("steam_total_count", ESTABLISHED_STEAM_REVIEWS)
    .order("steam_total_count", { ascending: false, nullsFirst: false })
    .order("id").limit(60));
  if (established.error) throw established.error;

  const editorial = await measureHomepagePhase('database', () => base()
    .eq("is_trending_manual", true).order("id").limit(20));
  if (editorial.error) throw editorial.error;

  return [...(activity.data ?? []), ...(established.data ?? []), ...(editorial.data ?? [])] as unknown as GameRow[];
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

export function getHomepageRecommendationScore(row: GameRow): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);
  const recencyBonus = ageDays <= 180
    ? 12
    : ageDays <= 365
      ? 8
    : ageDays <= 730
        ? 4
        : 0;
  const activityBonus = currentPlayers >= 15000
    ? 14
    : currentPlayers >= 7000
      ? 10
      : currentPlayers >= 2500
        ? 6
        : currentPlayers >= 1000
          ? 3
          : 0;
  const scaleBonus = evidenceReviewCount >= 100000
    ? 8
    : evidenceReviewCount >= 50000
      ? 6
      : evidenceReviewCount >= 10000
        ? 3
        : 0;
  const lowPresencePenalty = ageDays > 365 && currentPlayers < 500
    ? 14
    : ageDays > 180 && currentPlayers < 750
      ? 8
      : 0;

  return qualityScore + recencyBonus + activityBonus + scaleBonus - lowPresencePenalty;
}

export function isHomepageRecommendationEligible(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);

  if (ageDays > 365 && currentPlayers < 1000 && evidenceReviewCount < 25000) {
    return false;
  }

  if (ageDays > 180 && currentPlayers < 800 && evidenceReviewCount < 10000) {
    return false;
  }

  if (evidenceReviewCount >= 50000 || currentPlayers >= 2500) {
    return true;
  }

  if (evidenceReviewCount >= 10000 && currentPlayers >= 750) {
    return true;
  }

  if (evidenceReviewCount >= 5000 && currentPlayers >= 1000) {
    return true;
  }

  if (ageDays <= 60 && evidenceReviewCount >= 5000 && currentPlayers >= 400) {
    return true;
  }

  if (hasStrongCriticEvidence(row)) {
    return currentPlayers >= 1000
      || (ageDays <= 90 && evidenceReviewCount >= 5000 && currentPlayers >= 400)
      || (ageDays <= 45 && evidenceReviewCount >= 1500 && currentPlayers >= 100);
  }

  return evidenceReviewCount >= 2500 && currentPlayers >= 1500;
}

export function isHomepageRecommendationDistinctCandidate(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);

  if (!row.release_date || verdictScore < 82) {
    return false;
  }

  if (
    isHomepageHeroAutoCandidate(row)
    || isPremiumTrendingCandidate(row)
    || isHomepageTrendingEligible(row)
    || isHomepageTopRatedEligible(row)
  ) {
    return false;
  }

  if (ageDays > 365 && currentPlayers < 1000 && evidenceReviewCount < 25000) {
    return false;
  }

  if (ageDays > 180 && currentPlayers < 500 && evidenceReviewCount < 10000 && !hasStrongCriticEvidence(row)) {
    return false;
  }

  return hasStrongCriticEvidence(row)
    || evidenceReviewCount >= 5000
    || (evidenceReviewCount >= 2500 && currentPlayers >= 250)
    || currentPlayers >= 1500;
}

export function isHomepageRecommendationBackfillCandidate(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row).players;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getHomepageReleaseAgeDays(row.release_date);

  if (!row.release_date || verdictScore < 80) {
    return false;
  }

  if (
    isHomepageHeroAutoCandidate(row)
    || isPremiumTrendingCandidate(row)
    || isHomepageTrendingEligible(row)
    || isHomepageTopRatedEligible(row)
  ) {
    return false;
  }

  if (ageDays > 730 && currentPlayers < 750 && evidenceReviewCount < 25000) {
    return false;
  }

  if (ageDays > 365 && currentPlayers < 350 && evidenceReviewCount < 5000 && !hasStrongCriticEvidence(row)) {
    return false;
  }

  return hasStrongCriticEvidence(row)
    || evidenceReviewCount >= 2500
    || (evidenceReviewCount >= 1000 && currentPlayers >= 100)
    || currentPlayers >= 750;
}

export async function fetchNewReleases(limit = 20): Promise<Game[]> {
  const supabase = getPublicSupabase();
  const fetchLimit = getHomepageQueryFetchLimit(limit);
  const now = Date.now();
  const { today, cutoff, reviewed } = homepageReleaseWindow(now);
  const earliestStoredDate = reviewed.reduce((earliest, game) =>
    game.catalogueDate && game.catalogueDate < earliest ? game.catalogueDate : earliest, cutoff);
  const eligible = ['release_status.in.(released,"full release",full_release,full-release)'];
  if (reviewed.length) eligible.push(`slug.in.(${reviewed.map(game => game.slug).join(',')})`);

  // New Releases is a 90-day release-date rail, not a quality ranking.
  const { data, error } = await measureHomepagePhase('database', () => supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC + ",igdb_id,rawg_id")
    .or(eligible.join(','))
    .not("release_date", "is", null)
    .lte("release_date", today)
    .gte("release_date", earliestStoredDate)
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .neq("description", "")
    .order("release_date", { ascending: false })
    .limit(fetchLimit)) as { data: GameRow[] | null; error: unknown };

  if (error) throw error;

  return selectHomepageNewReleases(data ?? [], now).map(mapGameRow).filter(game => game.verdictLabel !== 'COMING SOON').slice(0, limit);
}

/* ═══════════════════════════════════════════════════
   Top Rated — CONTRACT
   ─────────────────────────────────────────────────
   Purpose:  Confidence-weighted best-scored recent games
   Requires: cover_image, review_count>=50, confidence>=0.3
   Excludes: is_provisional, COMING SOON
   Scoring:  confidenceWeightedScore()
   Homepage: 24mo, fallback 36mo, last resort 72mo
   ═══════════════════════════════════════════════════ */

/**
 * All-time top rated — used by /api/games/top-rated and explore pages.
 * No recency filter.
 */
export async function fetchTopRated(limit = 10): Promise<Game[]> {
  const supabase = getPublicSupabase();
  const fetchLimit = limit * 8;

  const { data, error } = await measureHomepagePhase('database', () => supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit)) as { data: GameRow[] | null; error: unknown };

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
 * Only recent releases (24mo, fallback 36mo, last resort 72mo) so the homepage feels current.
 */
export async function fetchHomepageTopRated(limit = 20): Promise<Game[]> {
  const supabase = getPublicSupabase();
  const fetchLimit = Math.max(getHomepageQueryFetchLimit(limit), HOMEPAGE_TOP_RATED_FETCH_TARGET);
  const cutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_MONTHS);

  const { data, error } = await measureHomepagePhase('database', () => supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC)
    .not("release_date", "is", null)
    .gte("release_date", cutoff)
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .gte("score", 70)
    .gte("confidence", 0.3)
    .gte("review_count", 75)
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(fetchLimit)) as { data: GameRow[] | null; error: unknown };

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
    const fallback = await measureHomepagePhase('database', () => supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("release_date", "is", null)
      .gte("release_date", widerCutoff)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .not("cover_image", "is", null)
      .neq("cover_image", "")
      .gte("score", 70)
      .gte("confidence", 0.3)
      .gte("review_count", 75)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("confidence", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(fetchLimit)) as { data: GameRow[] | null; error: unknown };

    if (!fallback.error && fallback.data) {
      ready = deduplicateBySteamAppId(fallback.data.filter((r) =>
        isSurfaceReady(r, "homepageRail") &&
        isPublicSafeGame(r) &&
        hasUsableCardImage(r)
      ));
      filtered = prioritizeById(filtered, filterQualityGames(ready, { section: "topRated", minResults: 4, allowReadinessFallback: false }), filtered.length + ready.length);
    }
  }

  // Last resort: widen to 72 months if still not enough
  if (filtered.length < limit) {
    const widestCutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_FALLBACK_MONTHS + 36);
    const widest = await measureHomepagePhase('database', () => supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("release_date", "is", null)
      .gte("release_date", widestCutoff)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .not("cover_image", "is", null)
      .neq("cover_image", "")
      .gte("score", 70)
      .gte("confidence", 0.3)
      .gte("review_count", 75)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("confidence", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(Math.max(getHomepageQueryFetchLimit(limit, 5), HOMEPAGE_TOP_RATED_EVERGREEN_FETCH_TARGET))) as { data: GameRow[] | null; error: unknown };

    if (!widest.error && widest.data) {
      ready = deduplicateBySteamAppId(widest.data.filter((r) =>
        isSurfaceReady(r, "homepageRail") &&
        isPublicSafeGame(r) &&
        hasUsableCardImage(r)
      ));
      filtered = prioritizeById(filtered, filterQualityGames(ready, { section: "topRated", minResults: 4, allowReadinessFallback: false }), filtered.length + ready.length);
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
  const desiredCount = Math.max(HOMEPAGE_RAIL_TARGET, limit);
  const primaryPool = homepageEligible.length > 0
    ? preferHomepageTopRatedPool(homepageEligible, desiredCount)
    : [];
  let evergreenBackfill: GameRow[] = [];

  if (primaryPool.length < desiredCount) {
    const evergreenCutoff = monthsAgoISO(HOMEPAGE_TOP_RATED_EVERGREEN_MONTHS);
    const evergreen = await measureHomepagePhase('database', () => supabase
      .from("games")
      .select(GAME_CARD_COLUMNS_WITH_DESC)
      .not("release_date", "is", null)
      .gte("release_date", evergreenCutoff)
      .lte("release_date", new Date().toISOString().slice(0, 10))
      .not("cover_image", "is", null)
      .neq("cover_image", "")
      .gte("score", 75)
      .gte("confidence", 0.4)
      .gte("review_count", 500)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("confidence", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(Math.max(getHomepageQueryFetchLimit(limit, 5), HOMEPAGE_TOP_RATED_EVERGREEN_FETCH_TARGET))) as { data: GameRow[] | null; error: unknown };

    if (!evergreen.error && evergreen.data) {
      const evergreenReady = deduplicateBySteamAppId(evergreen.data.filter((r) =>
        isSurfaceReady(r, "homepageRail") &&
        isPublicSafeGame(r) &&
        hasUsableCardImage(r)
      ));
      evergreenBackfill = filterQualityGames(evergreenReady, {
        section: "topRated",
        minResults: 4,
        allowReadinessFallback: false,
      }).filter((r) => {
        if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
        if (r.verdict_label === "COMING SOON") return false;
        if (isFutureDate(r.release_date)) return false;
        return isHomepageTopRatedEvergreenBackfillCandidate(r);
      });
    }
  }

  // Preferred evidence tiers influence rank, not minimum eligibility. Keep
  // qualified recent candidates even when just one preferred title survives.
  filtered = deduplicateBySteamAppId(prioritizeById(
    [...primaryPool, ...evergreenBackfill], filtered, primaryPool.length + evergreenBackfill.length + filtered.length,
  ));
  filtered.sort((a, b) => {
    const homepageEligibleDiff = Number(isHomepageTopRatedEligible(b)) - Number(isHomepageTopRatedEligible(a));
    if (homepageEligibleDiff !== 0) return homepageEligibleDiff;
    const tierDiff = getHomepageTopRatedEvidenceTier(b) - getHomepageTopRatedEvidenceTier(a);
    if (tierDiff !== 0) return tierDiff;
    return getHomepageTopRatedScore(b) - getHomepageTopRatedScore(a);
  });

  // Genre diversity: one per genre first, then fill
  const diversified = prioritizeById(applyGenreDiversity(filtered, limit, 2), filtered, limit);

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
  const fetchLimit = Math.min(240, Math.max(limit * 3, 160));
  const { data, error } = await measureHomepagePhase('database', () => supabase
    .from("games")
    .select(GAME_CARD_COLUMNS_WITH_DESC + ',franchise')
    .lte("release_date", new Date().toISOString().slice(0, 10))
    .gte("score", 75)
    .gte("review_count", 75)
    .gte("confidence", 0.4)
    .not("cover_image", "is", null)
    .neq("cover_image", "")
    .order("verdict_score", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .order("id")
    .limit(fetchLimit)) as { data: GameRow[] | null; error: unknown };
  if (error) throw error;

  const released = dedupePublicCanonicalRows((data ?? []).filter(row =>
    isSurfaceReady(row, "homepageRail") && isPublicSafeGame(row) && hasUsableCardImage(row)
    && !row.is_provisional && row.verdict_label !== "COMING SOON" && !hasUnreleasedStatus(row)
  ));
  const quality = filterQualityGames(released, {
    section: "recommendations",
    minResults: 4,
    allowReadinessFallback: false,
  });
  const scores = new Map(quality.map(row => [row.id, getHomepageRecommendationScore(row)
    + (isHomepageRecommendationEligible(row) ? 10 : 0)
    + (isHomepageRecommendationDistinctCandidate(row) ? 5 : 0)
    + (isHomepageRecommendationBackfillCandidate(row) ? 2 : 0)]));
  quality.sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || a.id.localeCompare(b.id));
  return removeRecommendationVariants(quality).slice(0, limit).map(mapGameRow);
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
  /** @deprecated Deals load separately when the visitor selects the tab. */
  deals: GXDeal[];
  recommendations: Game[];  // anonymous recommendations
}

export interface HomepageAnticipatedGame {
  catalogueId?: string;
  earlyAccess?: boolean;
  releaseWindow?: string;
  releaseTiming?: ReleaseTiming;
  imageKind?: 'cover' | 'artwork';
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

export const HOMEPAGE_REVALIDATE_SECONDS = 300;
export const HOMEPAGE_API_CACHE_CONTROL = `s-maxage=${HOMEPAGE_REVALIDATE_SECONDS}, stale-while-revalidate=300`;

export const EMPTY_HOMEPAGE_DATA: HomepageData = {
  hero: [],
  trending: [],
  topRated: [],
  newReleases: [],
  deals: [],
  recommendations: [],
};

// Next.js bypasses data-cache reads for nested unstable_cache calls. Keep each
// rail at the request boundary and coalesce only the in-flight assembly.
const sectionCacheOptions = { revalidate: HOMEPAGE_REVALIDATE_SECONDS };
const MAX_HOMEPAGE_RAIL_REFRESHES = 3;
let activeRailRefreshes = 0;
const waitingRailRefreshes: (() => void)[] = [];

async function acquireRailRefresh(signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (activeRailRefreshes < MAX_HOMEPAGE_RAIL_REFRESHES) {
    activeRailRefreshes++;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const wake = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => {
      const index = waitingRailRefreshes.indexOf(wake);
      if (index >= 0) waitingRailRefreshes.splice(index, 1);
      reject(signal?.reason);
    };
    waitingRailRefreshes.push(wake);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function cacheHomepageRail<T>(
  key: string,
  phase: 'refresh_hero' | 'refresh_trending' | 'refresh_new_releases' | 'refresh_top_rated' | 'refresh_recommendations',
  read: () => Promise<T>,
) {
  const refresh = coalesceCatalogueRead(async () => {
    const signal = currentHomepageSignal();
    await measureHomepagePhase('rail_queue', () => acquireRailRefresh(signal));
    try {
      signal?.throwIfAborted();
      const result = await measureHomepagePhase(phase, read);
      signal?.throwIfAborted();
      return result;
    } finally {
      const next = waitingRailRefreshes.shift();
      if (next) next();
      else activeRailRefreshes--;
    }
  });
  // Next includes the callback source in the key. Turbopack minifies the
  // page and route copies differently. Binding gives both the same native
  // callback representation, so the explicit versioned rail key identifies it.
  return unstable_cache(refresh.bind(null), [key], sectionCacheOptions);
}

const cachedHero = cacheHomepageRail('homepage-hero-v10', 'refresh_hero', () => fetchHeroCandidates(HOMEPAGE_HERO_FETCH_TARGET));
const cachedTrending = cacheHomepageRail('homepage-trending-v4', 'refresh_trending', fetchHomepageTrendingCandidates);
const cachedNewReleases = cacheHomepageRail('homepage-new-v6', 'refresh_new_releases', () => fetchNewReleases(HOMEPAGE_SECTION_FETCH_TARGET));
const cachedTopRated = cacheHomepageRail('homepage-top-v4', 'refresh_top_rated', () => fetchHomepageTopRated(HOMEPAGE_SECTION_FETCH_TARGET));
const cachedRecommendations = cacheHomepageRail('homepage-recommendations-v5', 'refresh_recommendations', () => fetchHomepageRecommendations(HOMEPAGE_SECTION_FETCH_TARGET));

const readHomepageData = coalesceCatalogueRead(fetchHomepageData);

const MOST_ANTICIPATED_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const EMPTY_MOST_ANTICIPATED = { data: [] as HomepageAnticipatedGame[], fetchedAt: null };

function isValidAnticipationSnapshot(fetchedAt: string | undefined): fetchedAt is string {
  if (!fetchedAt) return false;
  const age = Date.now() - Date.parse(fetchedAt);
  return age >= 0 && age <= MOST_ANTICIPATED_MAX_AGE_MS;
}

function isStillAnticipated(game: HomepageAnticipatedGame, today: string): boolean {
  const timing = game.releaseTiming;
  if (!timing) return game.tba || !game.released || game.released >= today;
  if (timing.precision === 'tba') return true;
  if (timing.precision === 'quarter') {
    const quarter = Number(timing.value.at(-1)) * 3;
    return timing.value.slice(0, 4) + '-' + String(quarter).padStart(2, '0') >= today.slice(0, 7);
  }
  return timing.value >= today.slice(0, timing.value.length);
}

const getCachedHomepageMostAnticipated = unstable_cache(
  coalesceCatalogueRead(async () => {
    const signal = currentHomepageSignal();
    const { loadExplore } = await import('@/lib/services/explore');
    // Keep a short reserve from the same loaded snapshot for windows that
    // expire between cache refreshes. No additional provider request.
    const data = await loadExplore('best-of-year', 1, HOMEPAGE_MOST_ANTICIPATED_TARGET + 5, undefined, undefined, 'default', '', undefined, { snapshotOnly: true });
    signal?.throwIfAborted();
    if (data.source !== 'rawg' || data.degraded || !isValidAnticipationSnapshot(data.fetchedAt)) {
      throw new Error('Discovery snapshot temporarily unavailable');
    }
    const seen = new Set<string>();
    const items = data.items.filter(item => {
      if (seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    }).map(item => {
        return {
          rawgId: item.rawgId, slug: item.slug, name: item.name, released: item.released, tba: item.tba,
          earlyAccess: item.earlyAccess, releaseWindow: item.releaseWindow, releaseTiming: item.releaseTiming,
          catalogueId: item.catalogueId, image: item.landscapeImage ?? item.image,
          imageKind: item.landscapeImageKind ?? item.imageKind, added: item.added, toplay: item.toplay, genres: item.genres,
        };
      });
    return { data: items, fetchedAt: data.fetchedAt };
  }),
  ["homepage-most-anticipated-v14"],
  { revalidate: 300 }
);

export async function loadHomepageData(): Promise<HomepageData> {
  return (await loadHomepageDataWithStatus()).data;
}

export async function loadHomepageDataWithStatus(): Promise<{ data: HomepageData; degraded: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { data: EMPTY_HOMEPAGE_DATA, degraded: true };
  }

  return measureHomepagePhase('homepage_total', () => readCachedCatalogue(readHomepageData, EMPTY_HOMEPAGE_DATA));
}

export async function loadHomepageMostAnticipated(): Promise<HomepageAnticipatedGame[]> {
  return (await loadHomepageMostAnticipatedWithStatus()).data;
}

export async function loadHomepageMostAnticipatedWithStatus() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      // Next retains the last successful cache value during stale revalidation.
      const snapshot = await boundedHomepageRead(3500, getCachedHomepageMostAnticipated);
      if (isValidAnticipationSnapshot(snapshot.fetchedAt)) {
        const today = new Date(Date.now()).toISOString().slice(0, 10);
        return {
          fetchedAt: snapshot.fetchedAt,
          degraded: false,
          data: snapshot.data.filter(game => isStillAnticipated(game, today)).slice(0, HOMEPAGE_MOST_ANTICIPATED_TARGET),
        };
      }
    } catch {
      // The independent rail can be omitted when no usable cached value exists.
    }
  }
  return { ...EMPTY_MOST_ANTICIPATED, degraded: true };
}

function resolveHomepageSection<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
  if (result.status === "fulfilled") {
    return result.value;
  }

  console.error(`[homepage] Failed to load ${label}:`, result.reason);
  return fallback;
}

function isReservedHomepageTopRatedGame(game: Game): boolean {
  const reviewCount = game.reviewCount ?? 0;
  const currentPlayers = game.currentPlayers ?? 0;
  const ageDays = getHomepageReleaseAgeDays(game.releaseDate);
  const hasStrongCriticEvidence = (game.igdbRating ?? 0) >= 88 || (game.rawgMetacritic ?? 0) >= 88;

  if (reviewCount >= 300000) {
    return currentPlayers >= 500 || ageDays <= 60;
  }

  if (reviewCount >= 100000) {
    return currentPlayers >= (ageDays > 365 ? 1000 : ageDays > 120 ? 650 : 400)
      || ageDays <= 45;
  }

  if (reviewCount >= 50000) {
    return currentPlayers >= (ageDays > 365 ? 1400 : ageDays > 120 ? 850 : 500);
  }

  if (hasStrongCriticEvidence) {
    return currentPlayers >= 2000
      || (ageDays <= 90 && reviewCount >= 15000 && currentPlayers >= 650)
      || (ageDays <= 45 && reviewCount >= 4000 && currentPlayers >= 250);
  }

  return (reviewCount >= 10000 && currentPlayers >= 750)
    || (reviewCount >= 5000 && currentPlayers >= 1200)
    || (ageDays <= 60 && reviewCount >= 5000 && currentPlayers >= 500)
    || (reviewCount >= 2500 && currentPlayers >= 1800);
}

export async function fetchHomepageData(): Promise<HomepageData> {
  // Rail cache lookups can overlap. The queue above caps database refreshes
  // even when stale lookups start background work together.
  const [heroResult, trendingPrimaryResult, newReleasesResult, topRatedResult, recsResult] = await Promise.allSettled([
    measureHomepagePhase('rail_hero', () => boundedHomepageRead(9000, cachedHero)),
    measureHomepagePhase('rail_trending', () => boundedHomepageRead(7500, cachedTrending)),
    measureHomepagePhase('rail_new_releases', () => boundedHomepageRead(7500, cachedNewReleases)),
    measureHomepagePhase('rail_top_rated', () => boundedHomepageRead(9000, cachedTopRated)),
    measureHomepagePhase('rail_recommendations', () => boundedHomepageRead(9000, cachedRecommendations)),
  ]);

  const finishSelection = startHomepagePhase('candidate_selection');
  const heroRaw = resolveHomepageSection(heroResult, "hero rail", [] as Game[]);
  const trendingRaw = resolveHomepageSection(trendingPrimaryResult, "trending rail", [] as GameRow[]);
  const { picks: popularity } = selectHomepagePopularity(trendingRaw, trendingRaw.length, Date.now());
  const topRatedRaw = resolveHomepageSection(topRatedResult, "top rated rail", [] as Game[]);
  const newReleasesRaw = resolveHomepageSection(newReleasesResult, "new releases rail", [] as Game[]);
  const recsRaw = resolveHomepageSection(recsResult, "recommendations rail", [] as Game[]);
  const sectionResults: Record<string, PromiseSettledResult<unknown>> = {
    hero: heroResult, trending: trendingPrimaryResult, newReleases: newReleasesResult,
    topRated: topRatedResult, recommendations: recsResult,
  };

  const { claim, wasClaimed } = createHomepageSlots();

  const trendingCandidates = popularity.map(({row, reason}) => ({...mapGameRow(row), trendingReason: reason}));
  const newReleaseCandidates = newReleasesRaw;

  // Claim in display priority. Protect the bounded popularity pool from reuse by Top Rated.
  const hero = claim(heroRaw, HOMEPAGE_HERO_TARGET, "hero");
  const trending = claim(trendingCandidates, HOMEPAGE_RAIL_TARGET, "trending");
  const topRatedClaimed = claim(topRatedRaw, HOMEPAGE_RAIL_TARGET, "topRated");
  const topRatedPremium = topRatedClaimed.filter(isReservedHomepageTopRatedGame);
  const topRated = topRatedPremium.length >= HOMEPAGE_PRIORITY_FLOOR
    ? prioritizeById(topRatedPremium, topRatedClaimed, HOMEPAGE_RAIL_TARGET)
    : topRatedClaimed;
  const newReleases = claim(newReleaseCandidates, HOMEPAGE_RAIL_TARGET, "newReleases");
  const exclusiveRecommendations = recsRaw.filter(game => !wasClaimed(game));
  const recommendationRanks = new Map(recsRaw.map((game, index) => [game.id, -index / 2]));
  const rankedRecommendations = diversifyRecommendations(exclusiveRecommendations, HOMEPAGE_RAIL_TARGET,
    game => recommendationRanks.get(game.id)!, game => Number(game.releaseDate.slice(0, 4)));
  const recommendations = claim([...rankedRecommendations, ...recsRaw], HOMEPAGE_RAIL_TARGET, "recommendations");

  finishSelection();
  return admitCataloguePayload({ hero, trending, topRated, newReleases, deals: [], recommendations }, sectionResults);
}

function prioritizeById<T extends { id: string }>(primary: T[], fallback: T[], limit: number): T[] {
  const ids = new Set<string>();
  const result: T[] = [];
  for (const item of [...primary, ...fallback]) {
    if (result.length === limit) break;
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    result.push(item);
  }
  return result;
}
