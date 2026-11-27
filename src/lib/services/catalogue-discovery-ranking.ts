import { rankCatalogueMatches } from "@/lib/services/catalogue-search-ranking";
import { mapGameRowAt } from "@/lib/db/mappers";
import type { Game, SortOption } from "@/lib/types";
import type { SearchGamesState } from "@/lib/search";
import type { GameRow } from "@/lib/supabase/types";
import { isFutureDate } from "@/lib/utils";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { confidenceWeightedScore, getCriticSourceCount, getEvidenceReviewCount,
  getNewReleaseDiscoveryScore, hasStrongCriticEvidence, isQualityGame } from "@/lib/utils/quality";
import { hasEarlyAccessSignal, hasKnownFullRelease, hasUnavailableStatus, hasUnreleasedStatus } from "@/lib/utils/release-status";
import { compareUpcomingTiming, resolveReleaseTiming } from "@/lib/utils/release-timing";
import { getReviewedReleaseTiming } from "@/lib/utils/reviewed-release-timing";
import { getFreshPlayerSignals, getPlayerGrowthEvidence, getPlayerGrowthRank } from "@/lib/utils/trending";
import { matchReviewedCatalogueRelease, matchReviewedPendingCatalogueRelease } from "./reviewed-catalogue-releases";

export function projectReviewedRelease(row: GameRow): GameRow {
  const reviewed = matchReviewedCatalogueRelease(row);
  return reviewed ? { ...row, release_date: reviewed.date, release_status: 'released', is_provisional:false } : row;
}

export function projectBrowseCard(row: GameRow, sort: SortOption, observedNow: number): Game {
  const game = mapGameRowAt(row, observedNow);
  if (sort === "trending") {
    return { ...game, trendingReason: getPlayerGrowthEvidence(row, observedNow) === "fresh" ? "Trending Up" : "Past Momentum" };
  }
  if (sort !== "upcoming") return game;
  const timing = getCatalogueUpcomingTiming(row, new Date(observedNow));
  const reviewed = matchReviewedPendingCatalogueRelease(row);
  return {
    ...game, description: "", releaseTiming: timing, releaseDateTba: timing.precision === "tba",
    releaseDate: timing.precision === "day" ? timing.value : timing.precision === "tba" ? "" : game.releaseDate,
    isProvisional: true, verdictLabel: "COMING SOON",
    releaseStatus: reviewed?.status ?? (hasEarlyAccessSignal(row) ? "early-access" : "upcoming"),
  };
}

function passesBrowseDiscoveryFloor(row: GameRow, observedNow: number): boolean {
  const reviewCount = getEvidenceReviewCount(row);
  const confidence = row.confidence ?? 0;
  const currentPlayers = getFreshPlayerSignals(row, observedNow).players;
  const qualityScore = confidenceWeightedScore(row);

  if (qualityScore < 74) {
    return false;
  }

  return reviewCount >= 50 || confidence >= 0.25 || currentPlayers >= 150 || qualityScore >= 84;
}

function getDateAgeDays(value: string | null | undefined, observedNow: number): number {
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

  return (observedNow - timestamp) / 86400000;
}

function getBrowseRelevanceDiscoveryScore(row: GameRow, observedNow: number): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const { players: currentPlayers, momentum } = getFreshPlayerSignals(row, observedNow);
  const ageDays = getDateAgeDays(row.release_date, observedNow);
  const freshness = ageDays <= 180
    ? 10
    : ageDays <= 365
      ? 8
      : ageDays <= 730
        ? 5
        : ageDays <= 1825
          ? 2
          : 0;

  return qualityScore
    + freshness
    + Math.min(10, Math.log10(evidenceReviewCount + 1) * 2.8)
    + Math.min(8, Math.log10(currentPlayers + 1) * 2.2)
    + Math.min(6, Math.max(0, momentum) * 22);
}

export function isBrowseTopRatedEligible(row: GameRow, observedNow = Date.now()): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row, observedNow).players;
  const ageDays = getDateAgeDays(row.release_date, observedNow);

  if (ageDays <= 120 && currentPlayers < 400 && evidenceReviewCount < 50000) {
    return false;
  }

  if (ageDays > 120 && ageDays <= 365 && currentPlayers < 500 && evidenceReviewCount < 100000) {
    return false;
  }

  if (ageDays > 365 && ageDays <= 1825 && currentPlayers < 750 && evidenceReviewCount < 150000) {
    return false;
  }

  if (ageDays > 1825 && currentPlayers < 500 && evidenceReviewCount < 300000) {
    return false;
  }

  if (evidenceReviewCount >= 300000) {
    return currentPlayers >= 500 || ageDays <= 3650;
  }

  if (evidenceReviewCount >= 100000) {
    return currentPlayers >= 250 || ageDays <= 2555;
  }

  if (evidenceReviewCount >= 50000) {
    return currentPlayers >= 300 || ageDays <= 1825;
  }

  if (hasStrongCriticEvidence(row)) {
    return currentPlayers >= 1500
      || (ageDays <= 365 && evidenceReviewCount >= 10000 && currentPlayers >= 400)
      || (ageDays <= 120 && evidenceReviewCount >= 2500 && currentPlayers >= 100);
  }

  if (evidenceReviewCount >= 10000 && currentPlayers >= 500) {
    return true;
  }

  if (evidenceReviewCount >= 5000 && currentPlayers >= 1000) {
    return true;
  }

  return ageDays <= 180 && evidenceReviewCount >= 2500 && currentPlayers >= 400;
}

export function getBrowseTopRatedScore(row: GameRow, observedNow = Date.now()): number {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const criticSources = getCriticSourceCount(row);
  const { players: currentPlayers, momentum } = getFreshPlayerSignals(row, observedNow);
  const ageDays = getDateAgeDays(row.release_date, observedNow);
  const reviewScore = Math.min(14, Math.log10(evidenceReviewCount + 1) * 3.1);
  const activityScore = Math.min(18, Math.log10(currentPlayers + 1) * 4.6);
  const recencyScore = ageDays <= 90
    ? 14
    : ageDays <= 180
      ? 11
      : ageDays <= 365
        ? 8
        : ageDays <= 730
          ? 4
          : ageDays <= 1825
            ? 1
            : 0;
  const criticBonus = criticSources >= 2 ? 4 : criticSources === 1 ? 1.5 : 0;
  const scaleBonus = evidenceReviewCount >= 300000
    ? 10
    : evidenceReviewCount >= 100000
      ? 8
      : evidenceReviewCount >= 50000
        ? 6
        : evidenceReviewCount >= 10000
          ? 3
          : 0;
  const momentumBonus = Math.min(4, Math.max(0, momentum) * 18);
  const lowPresencePenalty = ageDays > 3650 && currentPlayers < 1800
    ? 36
    : ageDays > 2555 && currentPlayers < 1200
      ? 28
      : ageDays > 1825 && currentPlayers < 800
        ? 20
        : ageDays > 730 && currentPlayers < 750
          ? 12
          : ageDays > 365 && currentPlayers < 500
            ? 6
            : 0;

  return qualityScore + reviewScore + activityScore + recencyScore + criticBonus + scaleBonus + momentumBonus - lowPresencePenalty;
}

function passesRecentlyAddedDiscoveryFloor(row: GameRow, observedNow: number): boolean {
  const qualityScore = confidenceWeightedScore(row);
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const currentPlayers = getFreshPlayerSignals(row, observedNow).players;
  const releaseAgeDays = getDateAgeDays(row.release_date, observedNow);

  if (!isPrimaryDiscoveryGame(row)) {
    return false;
  }

  if (qualityScore < 68) {
    return false;
  }

  if (releaseAgeDays > 365 * 5) {
    return false;
  }

  if (releaseAgeDays > 365 * 3 && qualityScore < 82 && evidenceReviewCount < 5000) {
    return false;
  }

  return evidenceReviewCount >= 20 || currentPlayers >= 50 || qualityScore >= 78;
}

export function getUpcomingMetadataScore(row: GameRow): number {
  const hasCredits = Boolean(row.developer?.trim() || row.publisher?.trim());
  const hasPlatforms = (row.platforms?.length ?? 0) > 0;
  const hasGenres = (row.genres?.length ?? 0) > 0;
  const hasDescription = Boolean(row.description && row.description.length >= 20);

  return Number(hasCredits) + Number(hasPlatforms) + Number(hasGenres) + Number(hasDescription);
}

export function getCatalogueUpcomingTiming(row: GameRow, now: Date) {
  const reviewed = matchReviewedPendingCatalogueRelease(row);
  return resolveReleaseTiming(row.release_date, {
    upcoming: true,
    tba: row.release_status?.trim().toLowerCase() === "tba" || !isFutureDate(row.release_date, now),
    evidence: reviewed?.timing ?? getReviewedReleaseTiming(row.rawg_id, row.release_date),
  });
}

function isUpcomingDiscoveryReady(row: GameRow, classified: boolean, now: Date): boolean {
  const hasCredits = Boolean(row.developer?.trim() || row.publisher?.trim());
  const hasPlatforms = (row.platforms?.length ?? 0) > 0;

  const reviewed = matchReviewedPendingCatalogueRelease(row);
  return (isFutureDate(row.release_date, now) || hasUnreleasedStatus(row) || hasEarlyAccessSignal(row)
      || Boolean(reviewed && (reviewed.timing.precision==='tba' || isFutureDate(reviewed.timing.value, now))))
    && !hasKnownFullRelease(row) && !matchReviewedCatalogueRelease(row)
    && !['cancelled','canceled','delisted'].includes((row.release_status || '').toLowerCase())
    && (classified || isPrimaryDiscoveryGame(row))
    && getUpcomingMetadataScore(row) >= 2
    && (hasCredits || hasPlatforms);
}

export function rankCatalogueCohort(data: GameRow[], state: Pick<SearchGamesState, "query" | "sort">,
  usesStoredClassification: boolean, observedNow = Date.now()): GameRow[] {
  const { query: q, sort } = state;
  const isRelevanceWithQuery = sort === "relevance" && Boolean(q);
  const isTopRated = sort === "top-rated";
  const isTrendingSort = sort === "trending";
  const isNewest = sort === "newest";
  const isUpcoming = sort === "upcoming";
  const isRecentlyAdded = sort === "recently-added";

  const justReleasedDays = 14;
  const now = new Date(observedNow);
  const todayStr = now.toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr);
  const isTrending = isTrendingSort;
  const isBroadDiscovery = !q && (isTopRated || isTrending || sort === "relevance" || isNewest || isUpcoming || isRecentlyAdded);

  const dated = isNewest ? data.map(projectReviewedRelease) : data;
  let rows = dated.filter((row) => {
    if (hasUnavailableStatus(row)) return false;
    const storedSafety=usesStoredClassification?(row as GameRow & {explore_primary_safe?:boolean|null}).explore_primary_safe:undefined;
    if (storedSafety===false || (storedSafety!==true && !isPublicSafeGame(row)) || !hasUsableCardImage(row)) {
      return false;
    }

    if (isBroadDiscovery && storedSafety!==true && !isPrimaryDiscoveryGame(row)) {
      return false;
    }

    if (isUpcoming) {
      return isUpcomingDiscoveryReady(row, storedSafety === true, now);
    }

    // Newest is a release-date view, not a confidence/popularity ranking.
    // Fresh console releases must not require Steam activity or old reviews.
    if (isNewest) {
      return Boolean(row.release_date && !isFutureDate(row.release_date, now))
        && hasKnownFullRelease(row);
    }

    if ((row as GameRow & { is_provisional?: boolean }).is_provisional) {
      return false;
    }

    if (row.verdict_label === "COMING SOON" || !q && hasUnreleasedStatus(row)) {
      return false;
    }

    if (isFutureDate(row.release_date, now)) {
      return false;
    }

    const reviewCount = row.review_count ?? 0;
    if (!isTrending && reviewCount === 0 && row.release_date) {
      const normalizedReleaseDate = /^\d{4}-\d{2}-\d{2}$/.test(row.release_date)
        ? `${row.release_date}T00:00:00Z`
        : /^\d{4}$/.test(row.release_date)
          ? `${row.release_date}-01-01T00:00:00Z`
          : row.release_date;
      const releaseMs = new Date(normalizedReleaseDate).getTime();
      if (Number.isNaN(releaseMs)) {
        return false;
      }
      const daysSinceRelease = (todayMs - releaseMs) / 86400000;
      if (daysSinceRelease > justReleasedDays) {
        return false;
      }
    }

    if (isTopRated && !isQualityGame(row, "topRated")) {
      return false;
    }

    if (isTrending && (!row.release_date || hasUnreleasedStatus(row) || !hasUsableCardImage(row) || !getPlayerGrowthEvidence(row, observedNow))) {
      return false;
    }


    if (isRecentlyAdded && !passesRecentlyAddedDiscoveryFloor(row, observedNow)) {
      return false;
    }

    if (sort === "relevance" && !q && !passesBrowseDiscoveryFloor(row, observedNow)) {
      return false;
    }

    return true;
  });

  if (!isRelevanceWithQuery) rows = dedupePublicCanonicalRows(rows, { query: q, observedNow });

  if (isTopRated && rows.length > 0) {
    rows = rows.filter(row => isBrowseTopRatedEligible(row, observedNow));
  }

  if (isTrending && rows.length > 0) {
    rows.sort((left, right) => Number(getPlayerGrowthEvidence(right, observedNow) === 'fresh') - Number(getPlayerGrowthEvidence(left, observedNow) === 'fresh')
      || getPlayerGrowthRank(right) - getPlayerGrowthRank(left) || left.id.localeCompare(right.id));
  } else if (isNewest && rows.length > 0) {
    rows.sort((left, right) => {
      const releaseDiff = (right.release_date ?? "").localeCompare(left.release_date ?? "");
      if (releaseDiff !== 0) return releaseDiff;
      const launchDiff = getNewReleaseDiscoveryScore(right, observedNow) - getNewReleaseDiscoveryScore(left, observedNow);
      if (launchDiff !== 0) return launchDiff;
      const reviewDiff = getEvidenceReviewCount(right) - getEvidenceReviewCount(left);
      if (reviewDiff !== 0) return reviewDiff;
      return getFreshPlayerSignals(right, observedNow).players - getFreshPlayerSignals(left, observedNow).players
        || left.id.localeCompare(right.id);
    });
  } else if (isRecentlyAdded && rows.length > 0) {
    rows.sort((left, right) => {
      const leftTime = left.created_at ? Date.parse(left.created_at) : -Infinity;
      const rightTime = right.created_at ? Date.parse(right.created_at) : -Infinity;
      return rightTime - leftTime || left.id.localeCompare(right.id);
    });
  } else if (isUpcoming && rows.length > 0) {
    rows = rows.map(row => ({ row, timing: getCatalogueUpcomingTiming(row, now) }))
      .sort(({ row: left, timing: leftTiming }, { row: right, timing: rightTiming }) =>
        compareUpcomingTiming(leftTiming, rightTiming, false)
        || getUpcomingMetadataScore(right) - getUpcomingMetadataScore(left)
        || confidenceWeightedScore(right) - confidenceWeightedScore(left)
        || getEvidenceReviewCount(right) - getEvidenceReviewCount(left)
        || left.id.localeCompare(right.id))
      .map(({ row }) => row);
  } else if (sort === "relevance" && !q && rows.length > 0) {
    rows.sort((left, right) => getBrowseRelevanceDiscoveryScore(right, observedNow) - getBrowseRelevanceDiscoveryScore(left, observedNow)
      || left.id.localeCompare(right.id));
  }

  if (isRelevanceWithQuery) rows = rankCatalogueMatches(rows, q, observedNow);


  if (isTopRated && rows.length > 0) {
    rows.sort((left, right) => {
      const scoreDiff = getBrowseTopRatedScore(right, observedNow) - getBrowseTopRatedScore(left, observedNow);
      if (scoreDiff !== 0) return scoreDiff;
      const reviewDiff = getEvidenceReviewCount(right) - getEvidenceReviewCount(left);
      if (reviewDiff !== 0) return reviewDiff;
      const playerDiff = getFreshPlayerSignals(right, observedNow).players - getFreshPlayerSignals(left, observedNow).players;
      if (playerDiff !== 0) return playerDiff;
      const criticDiff = getCriticSourceCount(right) - getCriticSourceCount(left);
      if (criticDiff !== 0) return criticDiff;
      return (right.release_date ?? "").localeCompare(left.release_date ?? "") || left.id.localeCompare(right.id);
    });
  }
  return rows;
}
