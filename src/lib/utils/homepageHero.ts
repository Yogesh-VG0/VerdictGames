import type { GameRow } from "@/lib/supabase/types";
import { getEvidenceReviewCount, hasStrongCriticEvidence } from "@/lib/utils/quality";
import { hasBrowseTrendingSignal } from "@/lib/utils/trending";

function getHomepageHeroAgeDays(row: Pick<GameRow, "release_date">): number {
  if (!row.release_date) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000;
}

export function isHomepageHeroAutoCandidate(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getHomepageHeroAgeDays(row);
  const hasSpotlightPresence = currentPlayers >= 1000 || momentum >= 0.05 || evidenceReviewCount >= 50000;
  const isFreshHeroWindow = ageDays <= 90;

  if (row.is_featured_manual ?? false) {
    return true;
  }

  if (!row.release_date || verdictScore < 80) {
    return false;
  }

  return (hasStrongCriticEvidence(row) && verdictScore >= 82 && (isFreshHeroWindow || hasSpotlightPresence))
    || (evidenceReviewCount >= 50000 && verdictScore >= 84)
    || (evidenceReviewCount >= 25000 && currentPlayers >= 250 && verdictScore >= 86)
    || (evidenceReviewCount >= 20000 && currentPlayers >= 3500 && verdictScore >= 84)
    || (ageDays <= 180 && evidenceReviewCount >= 10000 && currentPlayers >= 5000 && momentum >= 0.04 && verdictScore >= 83)
    || (ageDays <= 120 && hasBrowseTrendingSignal(row) && currentPlayers >= 10000 && momentum >= 0.08 && verdictScore >= 82)
    || (ageDays <= 90 && currentPlayers >= 8000 && momentum >= 0.07 && verdictScore >= 80);
}

export function getHomepageHeroScore(row: GameRow): number {
  const editorial = row.is_featured_manual ? 20 : 0;
  const verdict = Math.min(25, ((row.verdict_score ?? row.score ?? 0) / 100) * 25);
  const momentum = row.momentum ?? 0;
  const players = row.current_players ?? 0;
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const signalBoost = hasBrowseTrendingSignal(row) ? 6 : 0;
  const momentumBoost = Math.min(4, Math.max(0, momentum * 20));
  const playerBoost = Math.min(6, Math.log10(players + 1) * 1.8);
  const significance = signalBoost + momentumBoost + playerBoost;
  const ageDays = getHomepageHeroAgeDays(row);
  const freshness = ageDays < 120
    ? 20
    : ageDays < 240
      ? 14
      : ageDays < 365
        ? 10
        : ageDays < 730
          ? 6
          : ageDays < 1825
            ? 3
            : 0;
  const volume = Math.min(8, Math.log10(evidenceReviewCount + 1) * 2);
  const hasScreenshots = Array.isArray(row.screenshots) ? row.screenshots.length > 0 : Boolean(row.screenshots);
  const mediaQuality = (hasScreenshots ? 2.5 : 0) + (row.header_image ? 2.5 : 0);
  const lowPresencePenalty = ageDays > 60 && players < 150 && momentum < 0.03 && evidenceReviewCount < 50000
    ? 16
    : ageDays > 30 && players < 250 && momentum < 0.03 && evidenceReviewCount < 25000
      ? 10
      : 0;

  return editorial + verdict + significance + freshness + volume + mediaQuality - lowPresencePenalty;
}
