/**
 * VERDICT.GAMES — Quality Filtering
 *
 * Adaptive quality filters for homepage sections.
 * Different sections have different standards to avoid
 * killing indie, niche, or brand-new titles.
 */

import type { GameRow } from "@/lib/supabase/types";

export type SectionType = "trending" | "topRated" | "newReleases" | "deals" | "generic" | "hero";

interface QualityOpts {
  /** Minimum number of results — if filtering would go below this, return unfiltered */
  minResults?: number;
  /** Section type — determines thresholds */
  section?: SectionType;
}

const THRESHOLDS: Record<SectionType, { minReviews: number; minDescLen: number; requireImage: boolean; minConfidence?: number }> = {
  hero:        { minReviews: 1000, minDescLen: 50, requireImage: true, minConfidence: 0.8 },   // hero needs well-known, multi-source-validated games
  trending:    { minReviews: 20,  minDescLen: 20, requireImage: true },
  topRated:    { minReviews: 50,  minDescLen: 20, requireImage: true },
  newReleases: { minReviews: 0,   minDescLen: 10, requireImage: true },   // allow low reviews for new games
  deals:       { minReviews: 0,   minDescLen: 0,  requireImage: false },  // deals are external, less strict
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

  // Description check
  if (t.minDescLen > 0 && (!row.description || row.description.length < t.minDescLen)) return false;

  // Review count check
  if (row.review_count < t.minReviews) return false;

  // Confidence check (hero section requires multi-source validation)
  if (t.minConfidence && (row.confidence ?? 0) < t.minConfidence) return false;

  return true;
}

/**
 * Filter an array of game rows for quality, with safe fallback.
 * If filtering reduces below `minResults`, returns the original unfiltered list.
 */
export function filterQualityGames(
  rows: GameRow[],
  opts: QualityOpts = {}
): GameRow[] {
  const { minResults = 4, section = "generic" } = opts;
  const filtered = rows.filter((r) => isQualityGame(r, section));
  return filtered.length >= minResults ? filtered : rows;
}
