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

const THRESHOLDS: Record<SectionType, { minReviews: number; minDescLen: number; requireImage: boolean }> = {
  hero:        { minReviews: 100, minDescLen: 50, requireImage: true },   // hero needs well-known games
  trending:    { minReviews: 20,  minDescLen: 20, requireImage: true },
  topRated:    { minReviews: 50,  minDescLen: 20, requireImage: true },
  newReleases: { minReviews: 0,   minDescLen: 10, requireImage: true },   // allow low reviews for new games
  deals:       { minReviews: 0,   minDescLen: 0,  requireImage: false },  // deals are external, less strict
  generic:     { minReviews: 10,  minDescLen: 20, requireImage: true },
};

/**
 * Confidence-weighted score: penalizes games with very few reviews.
 * A 100% score from 91 reviews should rank lower than 97% from 245K reviews.
 * Uses Bayesian average approach: (R*v + C*m) / (v + m)
 * where R=score, v=review_count, C=global_mean (75), m=min_confidence (200)
 */
export function confidenceWeightedScore(row: GameRow): number {
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
