import type { GameRow, ListRow } from "@/lib/supabase/types";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { isQualityGame, isSurfaceReady } from "@/lib/utils/quality";
import {hasEarlyAccessSignal,hasKnownFullRelease} from './release-status';
import { editorialExclusion } from './editorial-eligibility.mjs';

type CuratedListDescriptor = Pick<ListRow, "is_system_managed" | "slug" | "tags">;

export function editorialListTitle(list: CuratedListDescriptor & Pick<ListRow, "title">): string {
  const annual = /^most-wanted-(\d{4})$/.exec(list.slug);
  const currentYear = new Date().getUTCFullYear();
  return list.is_system_managed && annual && Number(annual[1]) < currentYear
    ? `${list.title} (archive)`
    : list.title;
}

const UPCOMING_RELEASE_STATUSES = new Set(["announced", "coming_soon", "upcoming", "tba"]);

export function isUpcomingSystemManagedList(list: CuratedListDescriptor): boolean {
  return Boolean(
    list.is_system_managed
      && (list.slug.startsWith("most-wanted-") || (list.tags ?? []).some((tag) => tag.toLowerCase() === "upcoming"))
  );
}

export function isUpcomingCuratedListGame(row: GameRow): boolean {
  if(hasKnownFullRelease(row))return false;
  if(hasEarlyAccessSignal(row))return true;
  const today = new Date().toISOString().slice(0, 10);
  const releaseStatus = String(row.release_status ?? "").toLowerCase();
  if (["cancelled", "canceled", "delisted"].includes(releaseStatus)) return false;

  return Boolean(
    (row.release_date && row.release_date > today)
      || row.verdict_label === "COMING SOON"
      || row.is_provisional
      || UPCOMING_RELEASE_STATUSES.has(releaseStatus)
  );
}

export function passesCuratedListSelection(list: CuratedListDescriptor, row: GameRow): boolean {
  if (list.is_system_managed && (editorialExclusion(list.slug, row) || !isPrimaryDiscoveryGame(row))) return false;
  if (isUpcomingSystemManagedList(list)) {
    return isUpcomingCuratedListGame(row)
      && isPrimaryDiscoveryGame(row)
      && isSurfaceReady(row, "calendar");
  }

  return isSurfaceReady(row, "curatedList")
    && (!list.is_system_managed || isQualityGame(row, "curatedList"));
}
