/**
 * VERDICT.GAMES — Quality Filtering
 *
 * Adaptive quality filters for homepage sections.
 * Different sections have different standards to avoid
 * killing indie, niche, or brand-new titles.
 */

import type { GameRow } from "@/lib/supabase/types";

export type SectionType = "trending" | "topRated" | "newReleases" | "deals" | "generic";

interface QualityOpts {
  /** Minimum number of results — if filtering would go below this, return unfiltered */
  minResults?: number;
  /** Section type — determines thresholds */
  section?: SectionType;
}

const THRESHOLDS: Record<SectionType, { minReviews: number; minDescLen: number; requireImage: boolean }> = {
  trending:    { minReviews: 5,  minDescLen: 20, requireImage: true },
  topRated:    { minReviews: 10, minDescLen: 20, requireImage: true },
  newReleases: { minReviews: 0,  minDescLen: 10, requireImage: true },   // allow low reviews for new games
  deals:       { minReviews: 0,  minDescLen: 0,  requireImage: false },  // deals are external, less strict
  generic:     { minReviews: 5,  minDescLen: 20, requireImage: true },
};

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
