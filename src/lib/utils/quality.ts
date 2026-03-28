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

export type SectionType = "trending" | "topRated" | "newReleases" | "deals" | "generic" | "hero";

interface QualityOpts {
  /** Minimum number of results — if filtering would go below this, return
   *  readiness-filtered list instead of unfiltered list */
  minResults?: number;
  /** Section type — determines thresholds */
  section?: SectionType;
}

const THRESHOLDS: Record<SectionType, { minReviews: number; minDescLen: number; requireImage: boolean; minConfidence?: number; minCurrentPlayers?: number }> = {
  hero:        { minReviews: 10000, minDescLen: 50, requireImage: true, minConfidence: 0.8, minCurrentPlayers: 500 },
  trending:    { minReviews: 20,  minDescLen: 20, requireImage: true },
  topRated:    { minReviews: 50,  minDescLen: 20, requireImage: true },
  newReleases: { minReviews: 0,   minDescLen: 10, requireImage: true },
  deals:       { minReviews: 0,   minDescLen: 0,  requireImage: false },
  generic:     { minReviews: 10,  minDescLen: 20, requireImage: true },
};

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

/** Check if a single game row passes quality gates for the given section. */
export function isQualityGame(row: GameRow, section: SectionType = "generic"): boolean {
  const t = THRESHOLDS[section];

  // Image check
  if (t.requireImage && !row.cover_image) return false;

  // Description check (tolerant of missing description when using card-only columns)
  if (t.minDescLen > 0 && row.description != null && row.description.length < t.minDescLen) return false;

  // Review count check
  if (row.review_count < t.minReviews) return false;

  // Confidence check (hero section requires multi-source validation)
  if (t.minConfidence && (row.confidence ?? 0) < t.minConfidence) return false;

  // Current players check (hero section requires active player base)
  if (t.minCurrentPlayers && (row.current_players ?? 0) < t.minCurrentPlayers) return false;

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
  const { minResults = 4, section = "generic" } = opts;
  const filtered = rows.filter((r) => isQualityGame(r, section));

  if (filtered.length >= minResults) return filtered;

  // Fallback: still enforce surface readiness — never return imageless games
  // to public-facing surfaces even when quality filtering is relaxed.
  const readinessFiltered = rows.filter((r) => isSurfaceReady(r, "homepageRail"));
  return readinessFiltered.length >= minResults ? readinessFiltered : rows.filter((r) => isSurfaceReady(r, "searchResult"));
}
