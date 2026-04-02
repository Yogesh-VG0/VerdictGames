/**
 * VERDICT.GAMES — Quality Filtering & Surface Readiness
 *
 * Two independent concepts:
 *
 * 1. **Quality scoring** (`isQualityGame`, `confidenceWeightedScore`)
 *    Internal ranking signals. Never penalised for missing media.
 *
 * 2. **Surface readiness** (`isSurfaceReady`)
 *    Display-eligibility gating per surface. A game can have a high quality
 *    score yet fail surface readiness if it lacks required media.
 *
 * Quality scoring and surface readiness must never be conflated.
 */

import type { GameRow } from "@/lib/supabase/types";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { effectiveEvidenceReviewCount, resolveCommunityEvidenceSource } from "@/lib/utils/scoring";

/* ═══════════════════════════════════════════════════
   Surface-Specific Readiness Profiles
   ═══════════════════════════════════════════════════ */

/**
 * Each public surface has different display requirements.
 *
 * | Profile        | cover | title | desc>20 | genre≥1 | platform≥1 | header |
 * |----------------|-------|-------|---------|---------|------------|--------|
 * | homepageRail   |  ✅   |  ✅   |   ✅    |   ✅    |    ✅      |  —     |
 * | curatedList    |  ✅   |  ✅   |   ✅    |   ✅    |   soft     |  —*    |
 * | calendar       |  ✅   |  ✅   |  soft   |  soft   |   soft     |  —     |
 * | searchResult   |  ✅   |  ✅   |   —     |   —     |    —       |  —     |
 * | newsCard       | image |  ✅   |   —     |   —     |    —       |  —     |
 *
 * * Flagship curated lists additionally require header_image.
 */
export type ReadinessSurface =
  | "homepageRail"
  | "curatedList"
  | "calendar"
  | "searchResult"
  | "newsCard";

/**
 * Check if a game row meets the display-readiness requirements for a surface.
 *
 * This function ONLY checks media/data completeness — it does NOT evaluate
 * quality, confidence, review count, or score. Those are separate concerns
 * handled by `isQualityGame` and section-specific contract logic.
 */
export function isSurfaceReady(row: GameRow, surface: ReadinessSurface): boolean {
  switch (surface) {
    case "homepageRail":
      // Strictest: cover, title, description, genre, platform
      if (!row.cover_image) return false;
      if (!row.title) return false;
      if (!row.description || row.description.length < 20) return false;
      if (!row.genres || row.genres.length === 0) return false;
      if (!row.platforms || row.platforms.length === 0) return false;
      return true;

    case "curatedList":
      // Like homepage but platform is soft
      if (!row.cover_image) return false;
      if (!row.title) return false;
      if (!row.description || row.description.length < 20) return false;
      if (!row.genres || row.genres.length === 0) return false;
      return true;

    case "calendar":
      // Relaxed: future games often lack reviews/details
      if (!row.cover_image) return false;
      if (!row.title) return false;
      // description, genres, platforms are soft for upcoming games
      return true;

    case "searchResult":
      // Minimal: user explicitly searched for it
      if (!row.cover_image) return false;
      if (!row.title) return false;
      return true;

    case "newsCard":
      // News cards use GX schema, not GameRow. This is a structural guard
      // for any game-card rendering in news context. Only need cover + title.
      if (!row.cover_image) return false;
      if (!row.title) return false;
      return true;

    default:
      // Unknown surface → require cover + title at minimum
      if (!row.cover_image) return false;
      if (!row.title) return false;
      return true;
  }
}

/* ═══════════════════════════════════════════════════
   Quality Scoring (internal ranking — unchanged)
   ═══════════════════════════════════════════════════ */

export type SectionType = "trending" | "topRated" | "newReleases" | "deals" | "generic" | "hero" | "recommendations" | "curatedList";

interface QualityOpts {
  /** Minimum number of results — if filtering would go below this, return
   *  readiness-filtered list instead of unfiltered list */
  minResults?: number;
  /** Section type — determines thresholds */
  section?: SectionType;
  allowReadinessFallback?: boolean;
  fallbackSurface?: ReadinessSurface;
}

const THRESHOLDS: Record<SectionType, { minReviews: number; minDescLen: number; requireImage: boolean; minConfidence?: number; minCurrentPlayers?: number }> = {
  hero:            { minReviews: 5000, minDescLen: 50, requireImage: true, minConfidence: 0.5 },
  trending:        { minReviews: 75,   minDescLen: 20, requireImage: true, minConfidence: 0.25, minCurrentPlayers: 40 },
  topRated:        { minReviews: 500,  minDescLen: 20, requireImage: true, minConfidence: 0.35 },
  newReleases:     { minReviews: 0,    minDescLen: 20, requireImage: true },
  recommendations: { minReviews: 75,   minDescLen: 20, requireImage: true, minConfidence: 0.35 },
  curatedList:     { minReviews: 20,   minDescLen: 20, requireImage: true, minConfidence: 0.15 },
  deals:           { minReviews: 0,    minDescLen: 0,  requireImage: false },
  generic:         { minReviews: 10,   minDescLen: 20, requireImage: true },
};

const DISCOVERY_SECTIONS = new Set<SectionType>(["hero", "trending", "topRated", "recommendations", "curatedList"]);

type EvidenceRow = Pick<GameRow,
  | "critic_score"
  | "critic_source_count"
  | "confidence"
  | "igdb_rating"
  | "rawg_metacritic"
  | "rawg_rating"
  | "review_count"
  | "score_source"
  | "steam_app_id"
  | "steam_total_count"
  | "user_score"
>;

export function getCriticSourceCount(row: Pick<GameRow, "critic_source_count" | "igdb_rating" | "rawg_metacritic">): number {
  if (row.critic_source_count != null && row.critic_source_count > 0) {
    return row.critic_source_count;
  }

  let count = 0;
  if ((row.igdb_rating ?? 0) > 0) count += 1;
  if ((row.rawg_metacritic ?? 0) > 0) count += 1;
  return count;
}

export function getCommunityEvidenceSource(row: Pick<GameRow,
  "rawg_rating" | "review_count" | "score_source" | "steam_app_id" | "steam_total_count" | "user_score"
>) {
  return resolveCommunityEvidenceSource({
    steamTotalCount: row.steam_total_count,
    hasSteamData: row.score_source === "steam" || row.user_score != null || row.steam_app_id != null,
    rawgRating: row.rawg_rating,
    reviewCount: row.review_count,
  });
}

export function getEvidenceReviewCount(row: Pick<GameRow,
  "rawg_rating" | "review_count" | "score_source" | "steam_app_id" | "steam_total_count" | "user_score"
>): number {
  return effectiveEvidenceReviewCount(row.review_count ?? 0, getCommunityEvidenceSource(row));
}

export function hasStrongCriticEvidence(row: EvidenceRow): boolean {
  const criticSources = getCriticSourceCount(row);
  const criticScore = row.critic_score ?? Math.max(row.igdb_rating ?? 0, row.rawg_metacritic ?? 0);
  const confidence = row.confidence ?? 0;

  if (criticSources >= 2 && criticScore >= 82) {
    return true;
  }

  return criticSources >= 1 && criticScore >= 88 && confidence >= 0.3;
}

/**
 * Confidence-weighted score for ranking.
 *
 * v2 path (verdict_score + confidence available):
 *   Uses the pre-computed verdict_score (Wilson LB + critic blend) weighted
 *   by the confidence value. This naturally penalizes low-review games because
 *   Wilson LB already pulls them down, and confidence scales the result.
 *
 * Legacy path (pre-backfill rows):
 *   Bayesian average: (R*v + C*m) / (v + m)
 *
 * NOTE: This function NEVER penalises for missing media. Media is a readiness
 * concern, not a quality concern.
 */
export function confidenceWeightedScore(row: GameRow): number {
  // v2 path: use pre-computed verdict scoring
  if (row.verdict_score != null && row.verdict_score > 0) {
    const conf = row.confidence ?? 0;
    // Blend verdict_score toward global mean (70) based on confidence
    // At confidence=1.0 → full verdict_score
    // At confidence=0.0 → pulled heavily toward 70
    const GLOBAL_MEAN = 70;
    return row.verdict_score * (0.5 + conf * 0.5) + GLOBAL_MEAN * (0.5 - conf * 0.5);
  }

  // Legacy fallback
  const score = row.score ?? 0;
  const reviews = row.review_count ?? 0;
  const C = 75; // global mean score
  const m = 200; // minimum reviews for full confidence
  return (score * reviews + C * m) / (reviews + m);
}

function getReleaseAgeDays(row: Pick<GameRow, "release_date">): number {
  if (!row.release_date) {
    return Number.POSITIVE_INFINITY;
  }

  return (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000;
}

export function isStrongNewReleaseCandidate(row: GameRow): boolean {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getReleaseAgeDays(row);

  if (!row.release_date || !Number.isFinite(ageDays) || ageDays < 0) {
    return false;
  }

  if (qualityScore < 68) {
    return ageDays <= 3 && currentPlayers >= 2500 && momentum >= 0.08 && verdictScore >= 70;
  }

  if (evidenceReviewCount >= 25 && qualityScore >= 72) {
    return true;
  }

  if (ageDays <= 21 && evidenceReviewCount >= 10 && qualityScore >= 70) {
    return true;
  }

  if (ageDays <= 14 && evidenceReviewCount >= 5 && qualityScore >= 72) {
    return true;
  }

  if (ageDays <= 7 && hasStrongCriticEvidence(row) && verdictScore >= 75) {
    return true;
  }

  if (ageDays <= 7 && currentPlayers >= 500 && momentum >= 0.05 && verdictScore >= 70) {
    return true;
  }

  return ageDays <= 3 && currentPlayers >= 1200 && verdictScore >= 68;
}

export function getNewReleaseDiscoveryScore(row: GameRow): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = Math.max(0, row.momentum ?? 0);
  const ageDays = getReleaseAgeDays(row);
  const freshness = ageDays <= 7
    ? 16
    : ageDays <= 14
      ? 14
      : ageDays <= 30
        ? 10
        : ageDays <= 60
          ? 6
          : ageDays <= 120
            ? 2
            : 0;

  return qualityScore
    + freshness
    + Math.min(8, Math.log10(evidenceReviewCount + 1) * 2.6)
    + Math.min(6, Math.log10(currentPlayers + 1) * 1.8)
    + Math.min(6, momentum * 24);
}

export function hasStrongTopRatedEvidence(row: GameRow): boolean {
  return getEvidenceReviewCount(row) >= THRESHOLDS.topRated.minReviews || hasStrongCriticEvidence(row);
}

/** Check if a single game row passes quality gates for the given section. */
export function isQualityGame(row: GameRow, section: SectionType = "generic"): boolean {
  const t = THRESHOLDS[section];
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const canUseCriticFallback = section === "topRated" && hasStrongCriticEvidence(row);

  if (DISCOVERY_SECTIONS.has(section) && !isPrimaryDiscoveryGame(row)) return false;

  // Image check
  if (t.requireImage && !row.cover_image) return false;

  // Description check (tolerant of missing description when using card-only columns)
  if (t.minDescLen > 0 && row.description != null && row.description.length < t.minDescLen) return false;

  // Review count check
  if (t.minReviews > 0 && evidenceReviewCount < t.minReviews && !canUseCriticFallback) return false;

  // Confidence check (hero section requires multi-source validation)
  if (t.minConfidence && (row.confidence ?? 0) < t.minConfidence && !canUseCriticFallback) return false;

  // Current players check (hero section requires active player base)
  if (t.minCurrentPlayers && (row.current_players ?? 0) < t.minCurrentPlayers) return false;

  if (section === "newReleases" && !isStrongNewReleaseCandidate(row)) return false;

  if (section === "topRated" && !hasStrongTopRatedEvidence(row)) return false;

  return true;
}

/**
 * Filter an array of game rows for quality, with safe fallback.
 *
 * If filtering reduces below `minResults`, falls back to
 * surface-readiness-filtered list (never fully unfiltered — the hard
 * display-readiness floor is always enforced for public surfaces).
 */
export function filterQualityGames(
  rows: GameRow[],
  opts: QualityOpts = {}
): GameRow[] {
  const {
    minResults = 4,
    section = "generic",
    allowReadinessFallback = true,
    fallbackSurface = "homepageRail",
  } = opts;
  const filtered = rows.filter((r) => isQualityGame(r, section));

  if (filtered.length >= minResults || !allowReadinessFallback) return filtered;

  // Fallback: still enforce surface readiness — never return imageless games
  // to public-facing surfaces even when quality filtering is relaxed.
  const readinessFiltered = rows.filter((r) => isSurfaceReady(r, fallbackSurface));
  if (readinessFiltered.length >= minResults) return readinessFiltered;

  if (fallbackSurface !== "searchResult") {
    return rows.filter((r) => isSurfaceReady(r, "searchResult"));
  }

  return readinessFiltered;
}
