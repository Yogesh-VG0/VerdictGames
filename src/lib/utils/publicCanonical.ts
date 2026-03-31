import type { GameRow } from "@/lib/supabase/types";
import { getDiscoveryCanonicalTitle, isPackagingEditionTitle } from "@/lib/utils/discovery";
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

export function getPublicCanonicalGroup(row: Pick<GameRow, "steam_app_id" | "title" | "franchise">): string {
  if (row.steam_app_id != null && PUBLIC_GROUP_BY_STEAM_APP_ID[row.steam_app_id]) {
    return `special:${PUBLIC_GROUP_BY_STEAM_APP_ID[row.steam_app_id]}`;
  }

  const canonicalTitle = getDiscoveryCanonicalTitle(row.title);
  if (canonicalTitle !== normalizeTitle(row.title)) {
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
  const byGroup = new Map<string, T>();

  for (const row of rows) {
    const key = getPublicCanonicalGroup(row);
    const existing = byGroup.get(key);
    if (!existing) {
      byGroup.set(key, row);
      continue;
    }

    byGroup.set(key, pickPreferredPublicRepresentative(existing, row, preference));
  }

  return Array.from(byGroup.values());
}
