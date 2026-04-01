import type { GameRow } from "@/lib/supabase/types";
import { confidenceWeightedScore } from "@/lib/utils/quality";

function getTrendingAgeDays(row: Pick<GameRow, "release_date">): number {
  if (!row.release_date) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000;
}

function hasStrongFlaggedTrendingSignal(row: GameRow, qualityScore: number, ageDays: number): boolean {
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;
  if (!(row.trending ?? false) || qualityScore < 68) {
    return false;
  }

  if (ageDays <= 120) {
    return currentPlayers >= 1200 && momentum >= -0.02;
  }

  if (ageDays <= 730) {
    return currentPlayers >= 3500 && momentum >= 0.01;
  }

  if (ageDays <= 1825) {
    return currentPlayers >= 7000 && momentum >= 0.04;
  }

  return currentPlayers >= 12000 && momentum >= 0.05;
}

export function isPremiumTrendingCandidate(row: GameRow): boolean {
  const qualityScore = confidenceWeightedScore(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;
  const reviewCount = row.review_count ?? 0;
  const ageDays = getTrendingAgeDays(row);
  const hasLegacyHighActivityBreakout = ageDays > 365 * 2
    ? currentPlayers >= 18000 && momentum >= 0.05 && qualityScore >= 72
    : currentPlayers >= 20000 && momentum >= 0.03 && qualityScore >= 72;

  return (row.is_trending_manual ?? false)
    || hasStrongFlaggedTrendingSignal(row, qualityScore, ageDays)
    || hasLegacyHighActivityBreakout
    || (momentum >= 0.18 && currentPlayers >= 400 && reviewCount >= 200 && qualityScore >= 70)
    || (ageDays <= 60 && momentum >= 0.08 && currentPlayers >= 180 && reviewCount >= 120 && qualityScore >= 72);
}

export function isAcceptableTrendingCandidate(row: GameRow): boolean {
  const qualityScore = confidenceWeightedScore(row);
  const currentPlayers = row.current_players ?? 0;
  const momentum = row.momentum ?? 0;
  const reviewCount = row.review_count ?? 0;
  const ageDays = getTrendingAgeDays(row);
  const hasLegacyHighActivitySignal = ageDays > 365 * 2
    ? currentPlayers >= 12000 && momentum >= 0.05 && qualityScore >= 68
    : currentPlayers >= 8000 && momentum >= 0.04 && qualityScore >= 68;

  return isPremiumTrendingCandidate(row)
    || (row.is_trending_manual ?? false)
    || hasLegacyHighActivitySignal
    || (momentum >= 0.1 && currentPlayers >= 175 && reviewCount >= 90 && qualityScore >= 68)
    || (ageDays <= 120 && momentum >= 0.05 && currentPlayers >= 120 && reviewCount >= 75 && qualityScore >= 70)
    || hasStrongFlaggedTrendingSignal(row, qualityScore, ageDays);
}

export function getPublicTrendingScore(row: GameRow): number {
  const currentPlayers = row.current_players ?? 0;
  const reviewCount = row.review_count ?? 0;
  const momentum = row.momentum ?? 0;
  const qualityScore = confidenceWeightedScore(row);
  const ageDays = getTrendingAgeDays(row);
  const isManual = row.is_trending_manual ?? false;
  const isFlagged = row.trending ?? false;

  const manualBoost = isManual ? 25 : 0;
  const trendingBoost = isFlagged ? (momentum >= 0 ? 12 : currentPlayers >= 10000 ? 8 : 3) : 0;
  const playerScore = Math.min(38, Math.log10(currentPlayers + 1) * 9.75);
  const momentumScore = momentum >= 0
    ? Math.min(32, momentum * 90)
    : currentPlayers >= 20000
      ? Math.max(-8, momentum * 28)
      : Math.max(-24, momentum * 85);
  const reviewScore = Math.min(16, Math.log10(reviewCount + 1) * 4);
  const recencyScore = ageDays <= 30
    ? 20
    : ageDays <= 90
      ? 16
      : ageDays <= 180
        ? 12
        : ageDays <= 365
          ? 9
          : ageDays <= 730
            ? 5
            : ageDays <= 1825
              ? 2
              : 0;
  const qualityComponent = Math.min(18, qualityScore * 0.18);
  const scorePenalty = qualityScore < 70 ? (70 - qualityScore) * 0.8 : 0;
  const hardFallPenalty = momentum < -0.15
    ? currentPlayers >= 10000
      ? Math.min(4, Math.abs(momentum + 0.15) * 10)
      : Math.min(12, Math.abs(momentum + 0.15) * 22)
    : 0;
  const stalePenalty = ageDays > 365 * 4
    ? currentPlayers < 10000 || momentum < 0.03
      ? 8
      : 0
    : ageDays > 365 * 2 && (currentPlayers < 2500 || momentum < 0.03)
      ? 6
      : 0;

  return manualBoost
    + trendingBoost
    + playerScore
    + momentumScore
    + qualityComponent
    + reviewScore
    + recencyScore
    - scorePenalty
    - hardFallPenalty
    - stalePenalty;
}

export function hasBrowseTrendingSignal(row: GameRow): boolean {
  const momentum = row.momentum ?? 0;
  const currentPlayers = row.current_players ?? 0;
  const reviewCount = row.review_count ?? 0;
  const confidence = row.confidence ?? 0;
  const qualityScore = confidenceWeightedScore(row);
  const isManual = row.is_trending_manual ?? false;
  const ageDays = getTrendingAgeDays(row);
  const hasStrongFlaggedSignal = hasStrongFlaggedTrendingSignal(row, qualityScore, ageDays);
  const hasStrongEngagement = currentPlayers >= 600 && momentum >= 0.04 && qualityScore >= 68;
  const hasMomentumBreakout = momentum >= 0.08 && currentPlayers >= 150 && reviewCount >= 75 && qualityScore >= 68;
  const hasRecentBreakout = ageDays <= 120 && momentum >= 0.12 && currentPlayers >= 120 && reviewCount >= 120 && qualityScore >= 70;
  const hasHighActivityFallback = ageDays > 365 * 2
    ? currentPlayers >= 15000 && momentum >= 0.05 && qualityScore >= 68
    : currentPlayers >= 12000 && momentum >= 0.03 && qualityScore >= 68;
  const hasPremiumCandidate = isPremiumTrendingCandidate(row);
  const hasAcceptableCandidate = isAcceptableTrendingCandidate(row);

  if (reviewCount < 50) {
    return false;
  }

  if (confidence < 0.2 && reviewCount < 150) {
    return false;
  }

  if (!isManual && !hasStrongFlaggedSignal && currentPlayers < 40 && !(ageDays <= 120 && momentum >= 0.12 && reviewCount >= 100)) {
    return false;
  }

  if (momentum < -0.08 && currentPlayers < 4000 && !isManual) {
    return false;
  }

  if (momentum < -0.15 && currentPlayers < 12000 && !isManual && !hasStrongFlaggedSignal) {
    return false;
  }

  if (!isManual && ageDays > 365 * 2 && (currentPlayers < 2500 || momentum < 0.05) && !hasStrongFlaggedSignal) {
    return false;
  }

  if (!isManual && ageDays > 365 * 4 && (currentPlayers < 9000 || momentum < 0.05) && !hasStrongFlaggedSignal) {
    return false;
  }

  return hasPremiumCandidate
    || hasAcceptableCandidate
    || hasHighActivityFallback
    || hasStrongEngagement
    || hasMomentumBreakout
    || hasRecentBreakout
    || isManual
    || hasStrongFlaggedSignal;
}

export function preferTrendingMomentumPool(rows: GameRow[], desiredCount: number): GameRow[] {
  const risingMomentum = rows.filter((row) => {
    const qualityScore = confidenceWeightedScore(row);
    const ageDays = getTrendingAgeDays(row);
    return (row.is_trending_manual ?? false)
      || (row.momentum ?? 0) >= 0.1
      || hasStrongFlaggedTrendingSignal(row, qualityScore, ageDays)
      || ((row.current_players ?? 0) >= 15000 && (row.momentum ?? 0) >= 0.05);
  });
  if (risingMomentum.length >= desiredCount) {
    return risingMomentum;
  }

  const steadyMomentum = rows.filter((row) => {
    const qualityScore = confidenceWeightedScore(row);
    const ageDays = getTrendingAgeDays(row);
    return (row.is_trending_manual ?? false)
      || (row.momentum ?? 0) >= 0.05
      || hasStrongFlaggedTrendingSignal(row, qualityScore, ageDays)
      || ((row.current_players ?? 0) >= 10000 && (row.momentum ?? 0) >= 0.04);
  });
  if (steadyMomentum.length >= desiredCount) {
    return steadyMomentum;
  }

  const durableMomentum = rows.filter((row) => {
    const qualityScore = confidenceWeightedScore(row);
    const ageDays = getTrendingAgeDays(row);
    return (row.is_trending_manual ?? false)
      || (row.momentum ?? 0) >= 0.02
      || hasStrongFlaggedTrendingSignal(row, qualityScore, ageDays)
      || ((row.current_players ?? 0) >= 18000 && (row.momentum ?? 0) >= 0.04);
  });
  if (durableMomentum.length >= desiredCount) {
    return durableMomentum;
  }

  return rows;
}
