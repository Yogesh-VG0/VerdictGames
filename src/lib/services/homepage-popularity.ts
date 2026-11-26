import type { GameRow } from "@/lib/supabase/types";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { confidenceWeightedScore, isSurfaceReady } from "@/lib/utils/quality";
import { hasEarlyAccessSignal, hasKnownFullRelease, hasUnreleasedStatus } from "@/lib/utils/release-status";
import { getFreshPlayerSignals, getPlayerGrowthEvidence, getPlayerGrowthRank } from "@/lib/utils/trending";

export const ESTABLISHED_STEAM_REVIEWS = 50_000;
export const PLAYER_POPULARITY_MINIMUM = 750;
export const PLAYER_MOMENTUM_LOOKBACK_MS = 7 * 86_400_000;

const reasons = ["Trending Up", "Popular Now", "Past Momentum", "Established Popularity", "Editor's Pick"] as const;
type Reason = typeof reasons[number];
type Candidate = { row: GameRow; reason: Reason; evidence: number };
type Exclusion = "release" | "publicSafety" | "artwork" | "readiness" | "evidence";

function classify(row: GameRow, now: number, today: string, stableOnly: boolean): Candidate | Exclusion {
  const release = row.release_date ?? "";
  const releaseTime = Date.parse(release);
  if (!Number.isFinite(releaseTime) || new Date(releaseTime).toISOString().slice(0, 10) !== release || release > today
    || row.is_provisional || row.verdict_label === "COMING SOON" || hasUnreleasedStatus(row)) return "release";
  if (!isPublicSafeGame(row) || !isPrimaryDiscoveryGame(row)) return "publicSafety";
  if (!hasUsableCardImage(row)) return "artwork";
  if (!isSurfaceReady(row, "homepageRail")) return "readiness";

  const steamReviews = row.steam_app_id ? row.steam_total_count ?? 0 : 0;
  // Legacy records often lack explicit lifecycle. Verified Steam usage or
  // review volume can establish availability independently of the date.
  const growth = !stableOnly && row.steam_app_id ? getPlayerGrowthEvidence(row, now) : null;
  const players = !stableOnly && row.steam_app_id ? getFreshPlayerSignals(row, now).players : 0;
  if (!hasKnownFullRelease(row) && !hasEarlyAccessSignal(row) && steamReviews === 0 && !growth && players <= 0) return "release";
  if (!stableOnly && row.steam_app_id) {
    if (growth === "fresh") return { row, reason: "Trending Up", evidence: getPlayerGrowthRank(row) };
    if (players >= 4_000 || players >= PLAYER_POPULARITY_MINIMUM && steamReviews >= 10_000) {
      return { row, reason: "Popular Now", evidence: players };
    }
    if (growth === "stale") return { row, reason: "Past Momentum", evidence: getPlayerGrowthRank(row) };
  }
  if (steamReviews >= ESTABLISHED_STEAM_REVIEWS && confidenceWeightedScore(row) >= 65) {
    return { row, reason: "Established Popularity", evidence: steamReviews };
  }
  if (row.is_trending_manual) return { row, reason: "Editor's Pick", evidence: confidenceWeightedScore(row) };
  return "evidence";
}

export function selectHomepagePopularity(rows: GameRow[], limit: number, now: number, stableOnly = false) {
  const today = new Date(now).toISOString().slice(0, 10);
  const exclusions: Record<Exclusion | "duplicate", number> = {
    release: 0, publicSafety: 0, artwork: 0, readiness: 0, evidence: 0, duplicate: 0,
  };
  const uniqueRows = new Map(rows.map(row => [row.id, row]));
  const eligible = new Map<string, Candidate>();
  for (const row of uniqueRows.values()) {
    const candidate = classify(row, now, today, stableOnly);
    if (typeof candidate === "string") exclusions[candidate]++;
    else eligible.set(row.id, candidate);
  }
  exclusions.duplicate = rows.length - uniqueRows.size;
  const canonical = dedupePublicCanonicalRows([...eligible.values()].map(candidate => candidate.row), {
    query: "counter-strike 2",
    observedNow: now,
  });
  exclusions.duplicate += eligible.size - canonical.length;
  const picks = canonical.map(row => eligible.get(row.id)!)
    .sort((left, right) => reasons.indexOf(left.reason) - reasons.indexOf(right.reason)
      || right.evidence - left.evidence || left.row.id.localeCompare(right.row.id))
    .slice(0, limit);
  return { picks, exclusions };
}
