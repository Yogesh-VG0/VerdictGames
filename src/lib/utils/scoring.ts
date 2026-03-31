/**
 * VERDICT.GAMES — Scoring Engine v2
 *
 * Replaces the single-source waterfall score with a statistically sound
 * multi-signal scoring system.
 *
 * Key concepts:
 * - community_score:  Wilson Lower Bound of Steam/user positive ratio → 0-100
 * - critic_score:     Normalized average of IGDB + Metacritic → 0-100
 * - confidence:       0.0-1.0 based on review volume + source coverage
 * - verdict_score:    Final blended score used for display and sorting → 0-100
 */

import type { VerdictLabel } from "@/lib/types";

export type CommunityEvidenceSource = "steam" | "fallback" | "none";

export function resolveCommunityEvidenceSource({
  steamTotalCount,
  hasSteamData,
  rawgRating,
  reviewCount,
}: {
  steamTotalCount?: number | null;
  hasSteamData?: boolean;
  rawgRating?: number | null;
  reviewCount?: number | null;
}): CommunityEvidenceSource {
  if ((steamTotalCount ?? 0) > 0 || (hasSteamData && (reviewCount ?? 0) > 0)) {
    return "steam";
  }

  if ((rawgRating ?? 0) > 0 && (reviewCount ?? 0) > 0) {
    return "fallback";
  }

  return "none";
}

export function effectiveEvidenceReviewCount(
  reviewCount: number,
  communitySource: CommunityEvidenceSource,
): number {
  if (reviewCount <= 0) return 0;
  if (communitySource === "steam") return reviewCount;
  if (communitySource === "fallback") return Math.min(300, Math.round(reviewCount * 0.12));
  return 0;
}

/* ═══════════════════════════════════════════════════
   Wilson Lower Bound
   Gives a conservative estimate of the true positive
   ratio given a sample size. Small samples get pulled
   down; large samples stay near the raw ratio.
   ═══════════════════════════════════════════════════ */

/**
 * Wilson Lower Bound for a binomial proportion.
 * Returns the lower bound of the confidence interval (0-1).
 * z = 1.96 for 95% confidence (standard).
 */
export function wilsonLowerBound(positive: number, total: number, z = 1.96): number {
  if (total === 0) return 0;
  const p = positive / total;
  const zz = z * z;
  const denominator = 1 + zz / total;
  const center = p + zz / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + zz / (4 * total)) / total);
  return Math.max(0, (center - spread) / denominator);
}

/* ═══════════════════════════════════════════════════
   Community Score
   Wilson LB of Steam (or RAWG) positive ratio, scaled to 0-100.
   A game with 99/100 positive → ~95 (penalized for small sample)
   A game with 990K/1M positive → ~99 (large sample, trusted)
   ═══════════════════════════════════════════════════ */

export function computeCommunityScore(positive: number, total: number): number {
  if (total === 0) return 0;
  return Math.round(wilsonLowerBound(positive, total) * 100);
}

/* ═══════════════════════════════════════════════════
   Critic Score
   Normalized average of available professional sources.
   IGDB aggregated_rating and Metacritic are both 0-100 scales.
   ═══════════════════════════════════════════════════ */

export function computeCriticScore(
  igdbRating: number | null,
  metacritic: number | null
): { score: number | null; sourceCount: number } {
  const sources: number[] = [];
  if (igdbRating != null && igdbRating > 0) sources.push(igdbRating);
  if (metacritic != null && metacritic > 0) sources.push(metacritic);

  if (sources.length === 0) return { score: null, sourceCount: 0 };

  const avg = sources.reduce((a, b) => a + b, 0) / sources.length;
  return { score: Math.round(avg), sourceCount: sources.length };
}

/* ═══════════════════════════════════════════════════
   Confidence Score
   0.0 to 1.0 — how much we trust the verdict.
   Based on review volume (logarithmic) + source coverage.
   ═══════════════════════════════════════════════════ */

export function computeConfidence(
  reviewCount: number,
  criticSourceCount: number,
  communitySource: CommunityEvidenceSource
): number {
  const evidenceReviewCount = effectiveEvidenceReviewCount(reviewCount, communitySource);
  const reviewCap = communitySource === "steam"
    ? 0.65
    : communitySource === "fallback"
      ? 0.28
      : 0;
  const reviewComponent = evidenceReviewCount <= 0 || reviewCap === 0
    ? 0
    : Math.min(reviewCap, (Math.log10(evidenceReviewCount) / Math.log10(10000)) * reviewCap);

  let sourceComponent = 0;
  if (communitySource === "steam") sourceComponent += 0.15;
  if (communitySource === "fallback") sourceComponent += 0.05;
  if (criticSourceCount >= 1) sourceComponent += 0.12;
  if (criticSourceCount >= 2) sourceComponent += 0.08;

  return Math.min(1, reviewComponent + sourceComponent);
}

/* ═══════════════════════════════════════════════════
   Verdict Score
   Final blended score for display and sorting.
   Combines community and critic scores weighted by
   availability and confidence.
   ═══════════════════════════════════════════════════ */

export function computeVerdictScore(
  communityScore: number | null,
  criticScore: number | null,
  confidence: number
): number {
  const hasCommunity = communityScore != null && communityScore > 0;
  const hasCritic = criticScore != null && criticScore > 0;

  if (hasCommunity && hasCritic) {
    // Both sources: blend weighted by confidence
    // Higher confidence → slightly more community weight (crowd-validated)
    const communityWeight = 0.55 + confidence * 0.10; // 0.55-0.65
    const criticWeight = 1 - communityWeight;          // 0.35-0.45
    return Math.round(communityScore! * communityWeight + criticScore! * criticWeight);
  }

  if (hasCommunity) {
    // Community only: slight penalty for missing professional validation
    // At full confidence (1.0) → use raw score
    // At low confidence (0.0) → pull toward 70 (neutral zone)
    const dampFactor = 0.80 + confidence * 0.20; // 0.80-1.00
    return Math.round(communityScore! * dampFactor + 70 * (1 - dampFactor));
  }

  if (hasCritic) {
    // Critic only: professional reviews, generally trustworthy
    // Small penalty for no community validation
    return Math.round(criticScore! * 0.95 + 70 * 0.05);
  }

  // No data
  return 0;
}

/* ═══════════════════════════════════════════════════
   Verdict Label
   Uses verdict_score + confidence to assign a label.
   Low confidence prevents inflated labels (no "MUST PLAY"
   for a game with 50 reviews).
   ═══════════════════════════════════════════════════ */

export function getVerdictLabel(
  verdictScore: number,
  confidence: number,
  isUpcoming: boolean,
  isJustReleased: boolean
): VerdictLabel {
  // Override states
  if (isUpcoming) return "COMING SOON";
  if (isJustReleased) return "JUST RELEASED";

  // No meaningful data
  if (verdictScore <= 0) return "COMING SOON";

  // Low confidence: cap the maximum label at WORTH IT
  // Prevents tiny-sample games from getting MUST PLAY
  if (confidence < 0.30) {
    if (verdictScore >= 75) return "WORTH IT";
    if (verdictScore >= 50) return "MIXED";
    return "SKIP";
  }

  // Medium confidence: slightly stricter MUST PLAY threshold
  if (confidence < 0.50) {
    if (verdictScore >= 90) return "MUST PLAY";
    if (verdictScore >= 72) return "WORTH IT";
    if (verdictScore >= 50) return "MIXED";
    return "SKIP";
  }

  // High confidence: standard thresholds
  if (verdictScore >= 88) return "MUST PLAY";
  if (verdictScore >= 72) return "WORTH IT";
  if (verdictScore >= 50) return "MIXED";
  return "SKIP";
}

/* ═══════════════════════════════════════════════════
   Legacy Compatibility
   Converts RAWG user rating (0-5 scale) to a rough
   positive/total estimate for Wilson LB.
   ═══════════════════════════════════════════════════ */

export function rawgRatingToPositiveRatio(
  rating: number,
  ratingsCount: number
): { positive: number; total: number } {
  // RAWG rating is 0-5. Map to approximate positive ratio:
  // 4.5 → ~90% positive, 4.0 → ~80%, 3.5 → ~70%, 3.0 → ~60%
  const ratio = Math.max(0, Math.min(1, (rating - 1) / 4)); // 1→0, 5→1
  const positive = Math.round(ratio * ratingsCount);
  return { positive, total: ratingsCount };
}
