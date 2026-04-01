import { unstable_cache } from "next/cache";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { mapGameRow } from "@/lib/db/mappers";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import type { GameRow } from "@/lib/supabase/types";
import type { Game } from "@/lib/types";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { confidenceWeightedScore, isQualityGame } from "@/lib/utils/quality";
import { normalizeTitle } from "@/lib/utils/slugify";

export const RELATED_GAMES_REVALIDATE_SECONDS = 300;
export const RELATED_GAMES_API_CACHE_CONTROL = `s-maxage=${RELATED_GAMES_REVALIDATE_SECONDS}, stale-while-revalidate=300`;

const SELECT_COLUMNS = `${GAME_CARD_COLUMNS_WITH_DESC},franchise`;
const LOW_SIGNAL_TAGS = new Set([
  "singleplayer",
  "multiplayer",
  "steamachievements",
  "steamcloud",
  "fullcontrollersupport",
  "onlinemultiplayer",
  "localmultiplayer",
  "split screen",
  "splitscreen",
  "onlinecoop",
  "localcoop",
]);

type RelatedCandidateSource = "franchise" | "developer" | "genre" | "tag" | "fallback";

type RelatedCandidateBucket = {
  row: GameRow;
  sources: Set<RelatedCandidateSource>;
};

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 4;
  return Math.min(Math.max(Math.trunc(limit), 1), 12);
}

function normalizeSignal(value: string | null | undefined): string {
  return normalizeTitle(value ?? "");
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = normalizeSignal(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function pickSignalTags(tags: string[], genres: string[]): string[] {
  const genreKeys = new Set(genres.map((genre) => normalizeSignal(genre)));

  return uniqueStrings(tags).filter((tag) => {
    const key = normalizeSignal(tag);
    return key.length > 0 && !LOW_SIGNAL_TAGS.has(key) && !genreKeys.has(key);
  });
}

function getSharedCount(left: string[], right: string[]): number {
  const rightSet = new Set(right.map((value) => normalizeSignal(value)));
  return left.reduce((count, value) => count + (rightSet.has(normalizeSignal(value)) ? 1 : 0), 0);
}

function getGenreMatchScore(targetGenres: string[], candidateGenres: string[]): number {
  const candidateSet = new Set(candidateGenres.map((genre) => normalizeSignal(genre)));
  let score = 0;

  targetGenres.slice(0, 3).forEach((genre, index) => {
    if (!candidateSet.has(normalizeSignal(genre))) return;
    score += index === 0 ? 40 : index === 1 ? 24 : 14;
  });

  return score;
}

function getReleaseAffinityScore(targetReleaseDate: string | undefined, candidateReleaseDate: string | null | undefined): number {
  if (!targetReleaseDate || !candidateReleaseDate) return 0;

  const targetMs = new Date(targetReleaseDate).getTime();
  const candidateMs = new Date(candidateReleaseDate).getTime();
  if (!Number.isFinite(targetMs) || !Number.isFinite(candidateMs)) return 0;

  const diffDays = Math.abs(targetMs - candidateMs) / 86400000;
  if (diffDays <= 365) return 12;
  if (diffDays <= 365 * 3) return 8;
  if (diffDays <= 365 * 7) return 4;
  return 0;
}

function isSameValue(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeSignal(left);
  const b = normalizeSignal(right);
  return Boolean(a && b && a === b);
}

function isEligibleCandidate(target: Game, row: GameRow): boolean {
  if (row.id === target.id) return false;
  if (normalizeSignal(row.title) === normalizeSignal(target.title)) return false;
  if (!isPublicSafeGame(row) || !hasUsableCardImage(row)) return false;
  if ((row.is_provisional ?? false) || row.verdict_label === "COMING SOON") return false;
  if (row.release_date && row.release_date > new Date().toISOString().slice(0, 10)) return false;
  return true;
}

function scoreCandidate(target: Game, candidate: RelatedCandidateBucket): number {
  const row = candidate.row;
  const targetGenres = uniqueStrings(target.genres);
  const targetTags = pickSignalTags(target.tags, target.genres).slice(0, 4);
  const targetPlatforms = uniqueStrings(target.platforms);
  const candidateGenres = uniqueStrings(row.genres ?? []);
  const candidateTags = pickSignalTags(row.tags ?? [], row.genres ?? []);
  const candidatePlatforms = uniqueStrings((row.platforms ?? []).map((platform) => String(platform)));

  let score = 0;

  if (candidate.sources.has("franchise") || isSameValue(target.franchise, row.franchise)) {
    score += 130;
  }

  if (candidate.sources.has("developer") || isSameValue(target.developer, row.developer)) {
    score += 80;
  }

  if (isSameValue(target.publisher, row.publisher)) {
    score += 20;
  }

  if (candidate.sources.has("genre")) {
    score += 24;
  }

  if (candidate.sources.has("tag")) {
    score += 12;
  }

  score += getGenreMatchScore(targetGenres, candidateGenres);
  score += Math.min(getSharedCount(targetTags, candidateTags), 4) * 10;
  score += Math.min(getSharedCount(targetPlatforms, candidatePlatforms), 2) * 6;
  score += getReleaseAffinityScore(target.releaseDate, row.release_date);
  score += Math.min((row.confidence ?? 0) * 24, 24);
  score += Math.min(confidenceWeightedScore(row) / 4, 28);
  score += Math.min(Math.log10((row.review_count ?? 0) + 1) * 6, 16);
  score += Math.min(Math.log10((row.current_players ?? 0) + 1) * 4, 10);

  return score;
}

async function fetchCandidateRows(game: Game): Promise<RelatedCandidateBucket[]> {
  if (!hasPublicSupabaseEnv()) {
    return [];
  }

  const supabase = getPublicSupabase();
  const today = new Date().toISOString().slice(0, 10);

  async function selectRows(args: {
    source: RelatedCandidateSource;
    exact?: { column: "franchise" | "developer"; value: string };
    contains?: { column: "genres" | "tags"; value: string };
    limit: number;
    fallback?: boolean;
  }): Promise<{ source: RelatedCandidateSource; rows: GameRow[] }> {
    let query = supabase
      .from("games")
      .select(SELECT_COLUMNS)
      .neq("id", game.id)
      .not("cover_image", "is", null)
      .neq("cover_image", "")
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("confidence", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .order("updated_at", { ascending: false });

    if (args.exact) {
      query = query.eq(args.exact.column, args.exact.value);
    }

    if (args.contains) {
      query = query.contains(args.contains.column, [args.contains.value]);
    }

    if (args.fallback) {
      query = query.lte("release_date", today);
    }

    const { data } = await query.limit(args.limit) as unknown as { data: GameRow[] | null };
    return { source: args.source, rows: data ?? [] };
  }

  const targetGenres = uniqueStrings(game.genres).slice(0, 3);
  const targetTags = pickSignalTags(game.tags, game.genres).slice(0, 3);
  const queries: Array<Promise<{ source: RelatedCandidateSource; rows: GameRow[] }>> = [];

  if (game.franchise?.trim()) {
    queries.push(selectRows({
      source: "franchise",
      exact: { column: "franchise", value: game.franchise.trim() },
      limit: 16,
    }));
  }

  if (game.developer?.trim()) {
    queries.push(selectRows({
      source: "developer",
      exact: { column: "developer", value: game.developer.trim() },
      limit: 16,
    }));
  }

  targetGenres.slice(0, 2).forEach((genre) => {
    queries.push(selectRows({
      source: "genre",
      contains: { column: "genres", value: genre },
      limit: 24,
    }));
  });

  targetTags.forEach((tag) => {
    queries.push(selectRows({
      source: "tag",
      contains: { column: "tags", value: tag },
      limit: 18,
    }));
  });

  if (targetGenres[0]) {
    queries.push(selectRows({
      source: "fallback",
      contains: { column: "genres", value: targetGenres[0] },
      limit: 40,
      fallback: true,
    }));
  }

  const groups = await Promise.all(queries);
  const byId = new Map<string, RelatedCandidateBucket>();

  for (const group of groups) {
    for (const row of group.rows) {
      const existing = byId.get(row.id);
      if (existing) {
        existing.sources.add(group.source);
        continue;
      }

      byId.set(row.id, {
        row,
        sources: new Set<RelatedCandidateSource>([group.source]),
      });
    }
  }

  const mergedRows = Array.from(byId.values()).map((candidate) => candidate.row);
  const dedupedRows = dedupePublicCanonicalRows(mergedRows);
  const dedupedIds = new Set(dedupedRows.map((row) => row.id));

  return Array.from(byId.values()).filter((candidate) => dedupedIds.has(candidate.row.id));
}

async function fetchRelatedGames(game: Game, limit: number): Promise<Game[]> {
  const buckets = await fetchCandidateRows(game);
  const eligible = buckets.filter((candidate) => isEligibleCandidate(game, candidate.row));
  const qualityEligible = eligible.filter((candidate) => isQualityGame(candidate.row, "generic"));
  const pool = qualityEligible.length >= limit ? qualityEligible : eligible;

  return pool
    .sort((left, right) => {
      const scoreDiff = scoreCandidate(game, right) - scoreCandidate(game, left);
      if (scoreDiff !== 0) return scoreDiff;

      const rightVerdict = right.row.verdict_score ?? right.row.score ?? 0;
      const leftVerdict = left.row.verdict_score ?? left.row.score ?? 0;
      if (rightVerdict !== leftVerdict) return rightVerdict - leftVerdict;

      const rightReviews = right.row.review_count ?? 0;
      const leftReviews = left.row.review_count ?? 0;
      if (rightReviews !== leftReviews) return rightReviews - leftReviews;

      return (right.row.current_players ?? 0) - (left.row.current_players ?? 0);
    })
    .slice(0, limit)
    .map((candidate) => mapGameRow(candidate.row));
}

export async function getRelatedGamesForGame(game: Game, limit = 4): Promise<Game[]> {
  const safeLimit = clampLimit(limit);

  return unstable_cache(
    async () => fetchRelatedGames(game, safeLimit),
    ["related-games-v2", game.id, String(safeLimit)],
    { revalidate: RELATED_GAMES_REVALIDATE_SECONDS }
  )();
}
