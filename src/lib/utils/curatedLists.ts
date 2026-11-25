import type { GameRow, ListRow } from "@/lib/supabase/types";
import { isPrimaryDiscoveryGame } from "@/lib/utils/discovery";
import { isQualityGame, isSurfaceReady } from "@/lib/utils/quality";
import {hasEarlyAccessSignal,hasKnownFullRelease} from './release-status';
import { ANNUAL_LIST_TARGET, editorialExclusion } from './editorial-eligibility.mjs';
import type { ReleaseTiming } from './release-timing';

type CuratedListDescriptor = Pick<ListRow, "is_system_managed" | "slug" | "tags">;

export function isAnnualEditorialList(list: CuratedListDescriptor & Partial<Pick<ListRow, 'owner_id'>>): boolean {
  return list.is_system_managed && !list.owner_id && /^most-wanted-\d{4}$/.test(list.slug);
}

export function editorialListTitle(list: CuratedListDescriptor & Pick<ListRow, "title">, qualified = ANNUAL_LIST_TARGET): string {
  const annual = /^most-wanted-(\d{4})$/.exec(list.slug);
  const currentYear = new Date().getUTCFullYear();
  return isAnnualEditorialList(list) && annual && (Number(annual[1]) < currentYear || qualified < ANNUAL_LIST_TARGET)
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

export function passesCuratedListSelection(list: CuratedListDescriptor, row: GameRow, releaseTiming?: ReleaseTiming): boolean {
  if (list.is_system_managed && (editorialExclusion(list.slug, releaseTiming ? { ...row, releaseTiming } : row) || !isPrimaryDiscoveryGame(row))) return false;
  if (isUpcomingSystemManagedList(list)) {
    return isUpcomingCuratedListGame(row)
      && isPrimaryDiscoveryGame(row)
      && isSurfaceReady(row, "calendar");
  }

  return isSurfaceReady(row, "curatedList")
    && (!list.is_system_managed || isQualityGame(row, "curatedList"));
}
