import type { GameRow } from "@/lib/supabase/types";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { getEvidenceReviewCount, getNewReleaseDiscoveryScore, isSurfaceReady } from "@/lib/utils/quality";
import { hasKnownFullRelease, hasUnreleasedStatus } from "@/lib/utils/release-status";
import { getFreshPlayerSignals } from "@/lib/utils/trending";
import { matchReviewedCatalogueRelease, reviewedCatalogueReleases } from "./reviewed-catalogue-releases";

export function homepageReleaseWindow(now: number) {
  const today = new Date(now).toISOString().slice(0, 10);
  const cutoff = new Date(now - 90 * 86_400_000).toISOString().slice(0, 10);
  const reviewed = reviewedCatalogueReleases.filter(game => game.date >= cutoff && game.date <= today);
  return { today, cutoff, reviewed };
}

export function selectHomepageNewReleases(rows: GameRow[], now: number): GameRow[] {
  const { today, cutoff, reviewed } = homepageReleaseWindow(now);
  const ready = rows.flatMap(row => {
    if (row.is_provisional || row.verdict_label === "COMING SOON" || hasUnreleasedStatus(row)
      || !isSurfaceReady(row, "homepageRail") || !isPublicSafeGame(row)
      || !isPrimaryDiscoveryGame(row) || !hasUsableCardImage(row)) return [];
    const match = matchReviewedCatalogueRelease(row, reviewed);
    if (match) return [{ ...row, release_date: match.date, release_status: "released" }];
    const date = row.release_date ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= cutoff && date <= today
      && hasKnownFullRelease(row) && ((row.steam_app_id ?? 0) > 0 || (row.critic_source_count ?? 0) > 0) ? [row] : [];
  });
  return dedupePublicCanonicalRows(ready, { observedNow: now }).sort((a, b) =>
    b.release_date!.localeCompare(a.release_date!)
    || getNewReleaseDiscoveryScore(b, now) - getNewReleaseDiscoveryScore(a, now)
    || getEvidenceReviewCount(b) - getEvidenceReviewCount(a)
    || getFreshPlayerSignals(b, now).players - getFreshPlayerSignals(a, now).players
    || a.id.localeCompare(b.id));
}
