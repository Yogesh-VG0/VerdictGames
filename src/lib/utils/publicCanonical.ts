import type { GameRow } from "@/lib/supabase/types";
import {
  getDiscoveryCanonicalTitle,
  hasTitleDisambiguationYearSuffix,
  isPackagingEditionTitle,
} from "@/lib/utils/discovery";
import { normalizeTitle } from "@/lib/utils/slugify";

export type PublicCanonicalPreference =
  | "default"
  | "counter-strike-current"
  | "counter-strike-legacy"
  | "counter-strike-source"
  | "counter-strike-classic";

type PublicCanonicalRow = Pick<
  GameRow,
  | "title"
  | "franchise"
  | "developer"
  | "publisher"
  | "steam_app_id"
  | "current_players"
  | "verdict_score"
  | "score"
  | "review_count"
  | "confidence"
  | "release_date"
>;

const LEGACY_STEAM_APP_IDS = new Set([4465480]);
const COUNTER_STRIKE_CLASSIC_APP_IDS = new Set([10, 80]);
const PUBLIC_GROUP_BY_STEAM_APP_ID: Record<number, string> = {
  10: "counter-strike",
  80: "counter-strike",
  240: "counter-strike",
  730: "counter-strike",
  4465480: "counter-strike",
};

function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function queryMentionsCounterStrikeFamily(query: string): boolean {
  const normalized = normalizeQuery(query);
  return normalized.includes("counter strike") || /\b(csgo|cs2|global offensive)\b/i.test(normalized);
}

export function isLegacyStandaloneGame(row: Pick<GameRow, "steam_app_id">): boolean {
  return row.steam_app_id != null && LEGACY_STEAM_APP_IDS.has(row.steam_app_id);
}

export function queryExplicitlyWantsLegacyCs(query: string): boolean {
  const normalized = normalizeQuery(query);
  return /\b(cs\s*go|csgo|global offensive|legacy)\b/i.test(normalized);
}

export function getPublicCanonicalPreference(query = ""): PublicCanonicalPreference {
  const normalized = normalizeQuery(query);

  if (queryExplicitlyWantsLegacyCs(normalized)) {
    return "counter-strike-legacy";
  }

  if (queryMentionsCounterStrikeFamily(normalized)) {
    if (/\b(cs2|counter strike 2)\b/i.test(normalized)) {
      return "counter-strike-current";
    }

    if (/\bcounter strike source\b/i.test(normalized)) {
      return "counter-strike-source";
    }

    if (/\b(counter strike 1 6|condition zero|classic)\b/i.test(normalized)) {
      return "counter-strike-classic";
    }

    if (normalized.includes("counter strike")) {
      return "counter-strike-current";
    }
  }

  return "default";
}

function getCounterStrikePreferenceBoost(
  row: PublicCanonicalRow,
  preference: PublicCanonicalPreference
): number {
  const appId = row.steam_app_id ?? null;

  if (appId == null || PUBLIC_GROUP_BY_STEAM_APP_ID[appId] !== "counter-strike") {
    return 0;
  }

  switch (preference) {
    case "counter-strike-legacy":
      return appId === 4465480 ? 4000 : appId === 730 ? 500 : 0;
    case "counter-strike-source":
      return appId === 240 ? 4000 : appId === 730 ? 500 : 0;
    case "counter-strike-classic":
      if (COUNTER_STRIKE_CLASSIC_APP_IDS.has(appId)) {
        return appId === 10 ? 4100 : 4000;
      }
      return appId === 730 ? 500 : 0;
    case "counter-strike-current":
    case "default":
    default:
      return appId === 730 ? 4000 : appId === 4465480 ? -1000 : 0;
  }
}

function getReleaseDateDiffDays(left: string | null | undefined, right: string | null | undefined): number {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }

  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(leftMs - rightMs) / 86400000;
}

function hasMatchingCanonicalIdentity(left: PublicCanonicalRow, right: PublicCanonicalRow): boolean {
  const leftFranchise = normalizeTitle(left.franchise ?? "");
  const rightFranchise = normalizeTitle(right.franchise ?? "");
  if (leftFranchise && leftFranchise === rightFranchise) {
    return true;
  }

  const leftDeveloper = normalizeTitle(left.developer ?? "");
  const rightDeveloper = normalizeTitle(right.developer ?? "");
  if (leftDeveloper && leftDeveloper === rightDeveloper) {
    return true;
  }

  const leftPublisher = normalizeTitle(left.publisher ?? "");
  const rightPublisher = normalizeTitle(right.publisher ?? "");
  if (leftPublisher && leftPublisher === rightPublisher) {
    return true;
  }

  return getReleaseDateDiffDays(left.release_date, right.release_date) <= 730;
}

export function getPublicCanonicalGroup(
  row: Pick<GameRow, "steam_app_id" | "title" | "franchise">,
  options: { forceCanonicalTitles?: Set<string> } = {}
): string {
  if (row.steam_app_id != null && PUBLIC_GROUP_BY_STEAM_APP_ID[row.steam_app_id]) {
    return `special:${PUBLIC_GROUP_BY_STEAM_APP_ID[row.steam_app_id]}`;
  }

  const canonicalTitle = getDiscoveryCanonicalTitle(row.title);
  if (options.forceCanonicalTitles?.has(canonicalTitle) || canonicalTitle !== normalizeTitle(row.title)) {
    return `title:${canonicalTitle}`;
  }

  if (row.steam_app_id != null) {
    return `steam:${row.steam_app_id}`;
  }

  return `title:${canonicalTitle}`;
}

export function pickPreferredPublicRepresentative<T extends PublicCanonicalRow>(
  a: T,
  b: T,
  preference: PublicCanonicalPreference = "default"
): T {
  const score = (row: T) => {
    let value = 0;

    if (!isLegacyStandaloneGame(row)) {
      value += 1000;
    }

    if (isPackagingEditionTitle(row.title)) {
      value -= 150;
    }

    value += getCounterStrikePreferenceBoost(row, preference);
    value += Math.min((row.current_players ?? 0) / 1000, 500);
    value += (row.verdict_score ?? row.score ?? 0) * 2;
    value += Math.min((row.review_count ?? 0) / 1000, 200);
    value += (row.confidence ?? 0) * 150;

    if (row.release_date) {
      const ageDays = Math.max(0, (Date.now() - new Date(row.release_date).getTime()) / 86400000);
      value += Math.max(0, 60 - Math.min(ageDays / 30, 60));
    }

    return value;
  };

  return score(b) > score(a) ? b : a;
}

export function dedupePublicCanonicalRows<T extends PublicCanonicalRow>(
  rows: T[],
  options: { query?: string } = {}
): T[] {
  const preference = getPublicCanonicalPreference(options.query ?? "");
  const canonicalBuckets = new Map<string, T[]>();

  for (const row of rows) {
    const canonicalTitle = getDiscoveryCanonicalTitle(row.title);
    const bucket = canonicalBuckets.get(canonicalTitle);
    if (bucket) {
      bucket.push(row);
    } else {
      canonicalBuckets.set(canonicalTitle, [row]);
    }
  }

  const forceCanonicalTitles = new Set<string>();
  for (const [canonicalTitle, bucket] of canonicalBuckets) {
    if (bucket.some((row) => isPackagingEditionTitle(row.title))) {
      forceCanonicalTitles.add(canonicalTitle);
      continue;
    }

    const yearVariantRows = bucket.filter((row) => hasTitleDisambiguationYearSuffix(row.title));
    const baseRows = bucket.filter((row) => !hasTitleDisambiguationYearSuffix(row.title));
    if (yearVariantRows.some((variant) => baseRows.some((base) => hasMatchingCanonicalIdentity(variant, base)))) {
      forceCanonicalTitles.add(canonicalTitle);
    }
  }

  const byGroup = new Map<string, T>();

  for (const row of rows) {
    const key = getPublicCanonicalGroup(row, { forceCanonicalTitles });
    const existing = byGroup.get(key);
    if (!existing) {
      byGroup.set(key, row);
      continue;
    }

    byGroup.set(key, pickPreferredPublicRepresentative(existing, row, preference));
  }

  return Array.from(byGroup.values());
}
