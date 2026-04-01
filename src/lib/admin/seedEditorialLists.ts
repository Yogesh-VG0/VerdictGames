import { createHash } from "node:crypto";
import { writeAuditLog } from "@/lib/auditLog";
import { getServerSupabase } from "@/lib/supabase/server";
import type { GameRow, ListRow } from "@/lib/supabase/types";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";

export const SYSTEM_LIST_MANAGER = "system-curated-lists";
export const SYSTEM_LIST_SEED_VERSION = 3;

const SYSTEM_CURATOR = "editorial";
const MIN_LIST_REVIEWS = 20;
const MIN_ALLTIME_REVIEWS = 50;
const CANONICAL_COUNTER_STRIKE_APPS = new Set([10, 80, 240, 730, 4465480]);
const LEGACY_CANONICAL_APPS = new Set([4465480]);
const UPCOMING_RELEASE_STATUSES = new Set(["announced", "coming_soon", "upcoming", "tba"]);
const MULTIPLAYER_EXCLUSION_TAGS = ["Multiplayer", "Online Co-Op", "Co-op Campaign", "PvP", "MMO", "MMORPG"];
const SINGLE_PLAYER_RPG_EXCLUSION_TAGS = [...MULTIPLAYER_EXCLUSION_TAGS, "Battle Royale"];

type SeedListDefinition = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  matches: (game: GameRow) => boolean;
  compare?: (left: GameRow, right: GameRow) => number;
};

type ExistingSystemList = Pick<ListRow, "id" | "slug" | "title" | "seed_version" | "is_system_managed">;

function yearsAgoISO(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function hasAny(values: string[] | null | undefined, expected: string[]): boolean {
  return expected.some((value) => values?.includes(value));
}

function hasNone(values: string[] | null | undefined, blocked: string[]): boolean {
  return !blocked.some((value) => values?.includes(value));
}

function hasCover(game: GameRow): boolean {
  return Boolean(game.cover_image && game.cover_image.length > 0);
}

function getSeedScore(game: GameRow): number {
  const score = game.score ?? 0;
  const reviewCount = Math.max(game.review_count ?? 0, 0);
  return (score * reviewCount + 75 * 200) / (reviewCount + 200);
}

function compareByScore(left: GameRow, right: GameRow): number {
  const scoreDiff = getSeedScore(right) - getSeedScore(left);
  if (scoreDiff !== 0) return scoreDiff;
  const reviewDiff = (right.review_count ?? 0) - (left.review_count ?? 0);
  if (reviewDiff !== 0) return reviewDiff;
  return (right.current_players ?? 0) - (left.current_players ?? 0);
}

function compareByScoreThenPlayers(left: GameRow, right: GameRow): number {
  const scoreDiff = getSeedScore(right) - getSeedScore(left);
  if (scoreDiff !== 0) return scoreDiff;
  const playerDiff = (right.current_players ?? 0) - (left.current_players ?? 0);
  if (playerDiff !== 0) return playerDiff;
  return (right.review_count ?? 0) - (left.review_count ?? 0);
}

function compareByPlayersThenScore(left: GameRow, right: GameRow): number {
  const playerDiff = (right.current_players ?? 0) - (left.current_players ?? 0);
  if (playerDiff !== 0) return playerDiff;
  return compareByScore(left, right);
}

function compareUpcoming(left: GameRow, right: GameRow): number {
  const leftDate = left.release_date ? new Date(`${left.release_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const rightDate = right.release_date ? new Date(`${right.release_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  if (leftDate !== rightDate) return leftDate - rightDate;
  return compareByScore(left, right);
}

function compareHiddenGems(left: GameRow, right: GameRow): number {
  const scoreDiff = getSeedScore(right) - getSeedScore(left);
  if (scoreDiff !== 0) return scoreDiff;
  return (left.review_count ?? 0) - (right.review_count ?? 0);
}

function passesReleasedListFloor(
  game: GameRow,
  today: string,
  minScore: number,
  minReviews: number,
  options: { minDate?: string; maxReviews?: number } = {}
): boolean {
  const reviewCount = game.review_count ?? 0;
  if (!hasCover(game)) return false;
  if ((game.score ?? 0) < minScore) return false;
  if (reviewCount < minReviews) return false;
  if (options.maxReviews != null && reviewCount >= options.maxReviews) return false;
  if (game.verdict_label === "COMING SOON") return false;
  if (!game.release_date || game.release_date > today) return false;
  if (options.minDate && game.release_date < options.minDate) return false;
  return true;
}

function isUpcomingCandidate(game: GameRow, today: string, currentYear: number): boolean {
  if (!hasCover(game)) return false;
  const releaseStatus = String(game.release_status ?? "").toLowerCase();
  const yearEnd = `${currentYear}-12-31`;

  if (game.release_date) {
    return game.release_date > today && game.release_date <= yearEnd;
  }

  return Boolean(
    game.is_provisional
      || game.verdict_label === "COMING SOON"
      || UPCOMING_RELEASE_STATUSES.has(releaseStatus)
  );
}

function normalizeCanonicalText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCanonicalKey(row: Pick<GameRow, "steam_app_id" | "title">): string {
  if (row.steam_app_id != null && CANONICAL_COUNTER_STRIKE_APPS.has(row.steam_app_id)) {
    return "special:counter-strike";
  }

  if (row.steam_app_id != null) {
    return `steam:${row.steam_app_id}`;
  }

  return `title:${normalizeCanonicalText(row.title)}`;
}

function getCanonicalPreferenceScore(row: GameRow): number {
  let value = 0;

  if (!LEGACY_CANONICAL_APPS.has(row.steam_app_id ?? -1)) {
    value += 1000;
  }

  if (row.steam_app_id === 730) {
    value += 4000;
  }

  if (row.steam_app_id === 4465480) {
    value -= 1000;
  }

  value += Math.min((row.current_players ?? 0) / 1000, 500);
  value += (row.verdict_score ?? row.score ?? 0) * 2;
  value += Math.min((row.review_count ?? 0) / 1000, 200);
  value += (row.confidence ?? 0) * 150;

  if (row.release_date) {
    const ageDays = Math.max(0, (Date.now() - new Date(row.release_date).getTime()) / 86400000);
    value += Math.max(0, 60 - Math.min(ageDays / 30, 60));
  }

  return value;
}

function dedupeCanonicalGames(rows: GameRow[]): GameRow[] {
  const preferredByKey = new Map<string, GameRow>();

  for (const row of rows) {
    const key = getCanonicalKey(row);
    const existing = preferredByKey.get(key);
    if (!existing || getCanonicalPreferenceScore(row) > getCanonicalPreferenceScore(existing)) {
      preferredByKey.set(key, row);
    }
  }

  const preferredIds = new Set(Array.from(preferredByKey.values()).map((row) => row.id));
  return rows.filter((row) => preferredIds.has(row.id));
}

function buildSeedHash(seed: { slug: string; title: string; previewText: string; bodyText: string; tags: string[] }, gameIds: string[]) {
  return createHash("sha256")
    .update(JSON.stringify({
      slug: seed.slug,
      title: seed.title,
      previewText: seed.previewText,
      bodyText: seed.bodyText,
      tags: seed.tags,
      gameIds,
      seedVersion: SYSTEM_LIST_SEED_VERSION,
    }))
    .digest("hex");
}

function getEditorialSeedBlueprints(): SeedListDefinition[] {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const fourYearsAgo = yearsAgoISO(4);
  const fiveYearsAgo = yearsAgoISO(5);

  return [
    {
      slug: "best-single-player-rpgs",
      title: "Best Recent Single-Player RPGs",
      description: "Deep, solo RPG experiences from the last 4 years — rich worlds, complex systems, unforgettable stories.",
      tags: ["editorial", "rpg", "single-player"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_LIST_REVIEWS, { minDate: fourYearsAgo })
        && hasAny(game.genres, ["RPG"])
        && (
          hasAny(game.tags, ["Singleplayer", "Story Rich", "Choices Matter", "CRPG", "JRPG", "Action RPG"])
          || (hasAny(game.tags, ["Open World"]) && hasNone(game.tags, MULTIPLAYER_EXCLUSION_TAGS))
        )
        && hasNone(game.genres, ["Massively Multiplayer"])
        && hasNone(game.tags, SINGLE_PLAYER_RPG_EXCLUSION_TAGS),
    },
    {
      slug: "best-co-op-games",
      title: "Best Co-op Games Right Now",
      description: "Games built for playing together — local or online co-op that reward teamwork.",
      tags: ["editorial", "co-op", "multiplayer"],
      matches: (game) => passesReleasedListFloor(game, today, 74, MIN_LIST_REVIEWS, { minDate: fourYearsAgo })
        && hasAny(game.tags, ["Co-op", "Online Co-Op", "Local Co-Op", "Co-op Campaign"]),
      compare: compareByScoreThenPlayers,
    },
    {
      slug: "best-horror-games",
      title: "Best Recent Horror Games",
      description: "Survival horror, psychological terror, and atmospheric dread — the best horror games since 2021.",
      tags: ["editorial", "horror", "genre"],
      matches: (game) => passesReleasedListFloor(game, today, 72, MIN_LIST_REVIEWS, { minDate: fiveYearsAgo })
        && (hasAny(game.genres, ["Horror"]) || hasAny(game.tags, ["Horror", "Survival Horror", "Psychological Horror", "Lovecraftian"])),
    },
    {
      slug: "best-strategy-builder-games",
      title: "Best Strategy & Builder Games",
      description: "Grand strategy, 4X, city builders, and RTS games that demand your full attention.",
      tags: ["editorial", "strategy", "builder", "4x"],
      matches: (game) => passesReleasedListFloor(game, today, 76, MIN_LIST_REVIEWS, { minDate: fiveYearsAgo })
        && (hasAny(game.genres, ["Strategy"]) || hasAny(game.tags, ["City Builder", "Base Building", "4X", "Grand Strategy", "RTS", "Turn-Based Strategy", "Real Time Tactics"]))
        && hasNone(game.genres, ["RPG"]),
    },
    {
      slug: "best-story-driven-adventures",
      title: "Best Story-Driven Adventures",
      description: "Games where narrative is the star — cinematic storytelling, branching choices, emotional impact.",
      tags: ["editorial", "story", "narrative", "adventure"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_LIST_REVIEWS, { minDate: fourYearsAgo })
        && hasAny(game.tags, ["Story Rich", "Choices Matter", "Narrative", "Cinematic", "Visual Novel", "Interactive Fiction", "Emotional", "Multiple Endings"])
        && hasNone(game.genres, ["Strategy", "Sports", "Racing"])
        && hasNone(game.tags, ["Competitive", "PvP", "Battle Royale", "Multiplayer"]),
    },
    {
      slug: "best-indie-under-20-hours",
      title: "Best Indie Games Under 20 Hours",
      description: "Tight, focused indie experiences you can finish in a weekend. No filler, all killer.",
      tags: ["editorial", "indie", "short", "accessible"],
      matches: (game) => passesReleasedListFloor(game, today, 80, MIN_LIST_REVIEWS, { minDate: fourYearsAgo })
        && (hasAny(game.genres, ["Indie"]) || hasAny(game.tags, ["Indie"]))
        && game.hltb_main != null
        && game.hltb_main <= 20,
    },
    {
      slug: "best-competitive-multiplayer",
      title: "Best Competitive Multiplayer Games",
      description: "Shooters, fighters, MOBAs, and sports games with active ranked scenes and deep skill ceilings.",
      tags: ["editorial", "competitive", "multiplayer", "pvp"],
      matches: (game) => passesReleasedListFloor(game, today, 72, MIN_LIST_REVIEWS, { minDate: fiveYearsAgo })
        && hasAny(game.tags, ["PvP", "Competitive", "eSports", "Battle Royale", "Arena Shooter", "MOBA", "Team-Based", "Multiplayer"])
        && (hasAny(game.genres, ["Shooter", "Fighting", "Sports"]) || hasAny(game.tags, ["Fighting", "FPS", "Third-Person Shooter"]))
        && hasNone(game.genres, ["RPG", "Adventure", "Simulation", "Puzzle"])
        && hasNone(game.tags, ["Relaxing", "Casual", "Singleplayer", "Story Rich"]),
      compare: compareByPlayersThenScore,
    },
    {
      slug: `most-wanted-${currentYear}`,
      title: `Most Wanted Upcoming ${currentYear} Games`,
      description: `The most anticipated games releasing in ${currentYear}. Add them to your watchlist now.`,
      tags: ["editorial", "upcoming", String(currentYear), "wishlist"],
      matches: (game) => isUpcomingCandidate(game, today, currentYear),
      compare: compareUpcoming,
    },
    {
      slug: "best-deckbuilders-turn-based",
      title: "Best Deckbuilders & Turn-Based Games",
      description: "Roguelike deckbuilders, tactical turn-based RPGs, and deep card-game hybrids.",
      tags: ["editorial", "deckbuilder", "turn-based"],
      matches: (game) => passesReleasedListFloor(game, today, 76, MIN_LIST_REVIEWS, { minDate: fiveYearsAgo })
        && (hasAny(game.tags, ["Deckbuilder", "Card Game", "Turn-Based", "Turn-Based Combat", "Turn-Based Tactics", "Roguelike Deckbuilder"])
          || hasAny(game.genres, ["Card Game"])),
    },
    {
      slug: "hidden-gems-since-2024",
      title: "Hidden Gems Since 2024",
      description: "Critically acclaimed games since 2024 that didn't get the spotlight they deserved. High scores, low hype.",
      tags: ["editorial", "hidden-gems", "underrated", "2024"],
      matches: (game) => passesReleasedListFloor(game, today, 82, MIN_LIST_REVIEWS, { minDate: "2024-01-01", maxReviews: 1000 }),
      compare: compareHiddenGems,
    },
    {
      slug: "sci-fi-epics",
      title: "Sci-Fi Epics",
      description: "Sprawling science fiction adventures across space, time, and cyberpunk cityscapes.",
      tags: ["editorial", "sci-fi", "space", "cyberpunk"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_ALLTIME_REVIEWS)
        && hasAny(game.tags, ["Sci-fi", "Space", "Cyberpunk", "Futuristic"]),
    },
    {
      slug: "best-platformers",
      title: "Best Platformers",
      description: "Precision jumps, creative level design, and tight controls — 2D and 3D platforming at its finest.",
      tags: ["editorial", "platformer", "2d", "3d"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_ALLTIME_REVIEWS)
        && (hasAny(game.genres, ["Platformer"]) || hasAny(game.tags, ["Platformer", "2D Platformer", "3D Platformer", "Precision Platformer", "Collectathon"]))
        && hasNone(game.genres, ["Sports", "Racing", "Strategy", "Simulation"])
        && hasNone(game.tags, ["Multiplayer", "PvP", "MMO", "MMORPG"]),
    },
    {
      slug: "best-roguelikes-roguelites",
      title: "Best Roguelikes & Roguelites",
      description: "Procedural runs, permadeath tension, and the 'just one more run' loop perfected.",
      tags: ["editorial", "roguelike", "roguelite", "procedural"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_ALLTIME_REVIEWS)
        && hasAny(game.tags, ["Roguelike", "Roguelite", "Roguevania", "Roguelike Deckbuilder"]),
    },
    {
      slug: "critically-acclaimed-2024",
      title: "Critically Acclaimed in 2024",
      description: "The highest-rated games released in 2024, backed by strong review consensus.",
      tags: ["editorial", "2024", "critically-acclaimed", "best-of"],
      matches: (game) => passesReleasedListFloor(game, today, 80, MIN_ALLTIME_REVIEWS, { minDate: "2024-01-01" })
        && game.release_date != null
        && game.release_date <= "2024-12-31",
    },
    {
      slug: "best-multiplayer-experiences",
      title: "Best Multiplayer Experiences",
      description: "The best games to play with friends or strangers — from co-op adventures to party games.",
      tags: ["editorial", "multiplayer", "social", "party"],
      matches: (game) => passesReleasedListFloor(game, today, 76, MIN_ALLTIME_REVIEWS)
        && (hasAny(game.tags, ["Multiplayer", "Online Co-Op", "Local Multiplayer", "Local Co-Op", "Party Game"])
          || hasAny(game.genres, ["Massively Multiplayer"])),
      compare: compareByScoreThenPlayers,
    },
    {
      slug: "survival-horror-essentials",
      title: "Survival Horror Essentials",
      description: "Resource management meets terror — the best survival horror games of all time.",
      tags: ["editorial", "survival-horror", "horror", "classic"],
      matches: (game) => passesReleasedListFloor(game, today, 76, MIN_ALLTIME_REVIEWS)
        && hasAny(game.tags, ["Survival Horror", "Psychological Horror", "Horror"])
        && (hasAny(game.tags, ["Survival", "Resource Management", "Atmospheric", "Dark"]) || hasAny(game.genres, ["Horror"]))
        && hasNone(game.genres, ["Strategy", "Sports", "Racing", "Puzzle"])
        && hasNone(game.tags, ["Comedy", "Funny", "Cute", "Relaxing"]),
    },
    {
      slug: "best-strategy-games",
      title: "Best Strategy Games",
      description: "All-time greats in tactics, grand strategy, 4X, and real-time strategy.",
      tags: ["editorial", "strategy", "tactics", "all-time"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_ALLTIME_REVIEWS)
        && hasAny(game.genres, ["Strategy"]),
    },
    {
      slug: "top-open-world-adventures",
      title: "Top Open World Adventures",
      description: "Vast, explorable worlds packed with discovery, quests, and emergent storytelling.",
      tags: ["editorial", "open-world", "exploration", "adventure"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_ALLTIME_REVIEWS)
        && hasAny(game.tags, ["Open World"])
        && (hasAny(game.genres, ["Adventure", "Action", "RPG"]) || hasAny(game.tags, ["Exploration", "Story Rich", "Action RPG", "Action-Adventure"]))
        && hasNone(game.genres, ["Sports", "Racing", "Simulation", "Strategy"])
        && hasNone(game.tags, ["City Builder", "Base Building", "Colony Sim", "Management", "Competitive", "PvP", "MMO", "MMORPG"]),
    },
    {
      slug: "essential-metroidvanias",
      title: "Essential Metroidvanias",
      description: "Interconnected maps, ability-gated exploration, and satisfying progression loops.",
      tags: ["editorial", "metroidvania", "exploration", "2d"],
      matches: (game) => passesReleasedListFloor(game, today, 78, MIN_ALLTIME_REVIEWS)
        && hasAny(game.tags, ["Metroidvania"]),
    },
    {
      slug: "hidden-indie-gems",
      title: "Hidden Indie Gems",
      description: "Under-the-radar indie games with outstanding quality — small studios, big impact.",
      tags: ["editorial", "indie", "hidden-gems", "underrated"],
      matches: (game) => passesReleasedListFloor(game, today, 84, MIN_LIST_REVIEWS, { maxReviews: 500 })
        && (hasAny(game.genres, ["Indie"]) || hasAny(game.tags, ["Indie"])),
    },
    {
      slug: "cozy-games-to-unwind",
      title: "Cozy Games to Unwind With",
      description: "Gentle, relaxing experiences perfect for unwinding — farming, crafting, and wholesome adventures.",
      tags: ["editorial", "cozy", "relaxing", "casual"],
      matches: (game) => passesReleasedListFloor(game, today, 76, MIN_LIST_REVIEWS)
        && hasAny(game.tags, ["Relaxing", "Casual", "Wholesome", "Cozy", "Farming Sim", "Life Sim"]),
    },
    {
      slug: "best-action-rpgs",
      title: "Best Action RPGs of All Time",
      description: "Real-time combat meets deep progression — the finest action RPGs ever made.",
      tags: ["editorial", "action-rpg", "rpg", "action"],
      matches: (game) => passesReleasedListFloor(game, today, 80, MIN_ALLTIME_REVIEWS)
        && hasAny(game.genres, ["RPG"])
        && (
          hasAny(game.tags, ["Action RPG", "Souls-like", "Hack and Slash"])
          || (hasAny(game.genres, ["Action"]) && hasAny(game.tags, ["Action RPG"]))
        )
        && (hasNone(game.tags, ["Action-Adventure"]) || hasAny(game.tags, ["Action RPG"])),
    },
  ];
}

async function fetchAllGames(): Promise<GameRow[]> {
  const supabase = getServerSupabase();
  const pageSize = 1000;
  const rows: GameRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1) as { data: GameRow[] | null; error: { message: string } | null };

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

export function getEditorialSeedSummaries(): Array<Pick<SeedListDefinition, "slug" | "title">> {
  return getEditorialSeedBlueprints().map(({ slug, title }) => ({ slug, title }));
}

export async function seedEditorialLists(editedBy: string): Promise<string[]> {
  const supabase = getServerSupabase();
  const blueprints = getEditorialSeedBlueprints();
  const seedSlugs = blueprints.map((seed) => seed.slug);
  const results: string[] = [];
  const usedCoverImages = new Set<string>();
  const gameAppearanceCount = new Map<string, number>();
  const seededListSets = new Map<string, Set<string>>();

  const [games, existingListsRes, staleListsRes] = await Promise.all([
    fetchAllGames(),
    supabase
      .from("lists")
      .select("id, slug, title, seed_version, is_system_managed")
      .in("slug", seedSlugs),
    supabase
      .from("lists")
      .select("id, slug")
      .eq("is_system_managed", true)
      .eq("managed_by", SYSTEM_LIST_MANAGER),
  ]);

  if (existingListsRes.error) {
    throw new Error(existingListsRes.error.message);
  }

  if (staleListsRes.error) {
    throw new Error(staleListsRes.error.message);
  }

  const existingLists = (existingListsRes.data ?? []) as ExistingSystemList[];
  const existingListsBySlug = new Map(existingLists.map((list) => [list.slug, list]));
  const rowsById = new Map(games.map((game) => [game.id, game]));

  function enforceOverlapConstraints(ids: string[], maxPerGame = 3): string[] {
    return ids.filter((id) => (gameAppearanceCount.get(id) ?? 0) < maxPerGame);
  }

  function recordAppearances(slug: string, ids: string[]) {
    seededListSets.set(slug, new Set(ids));
    for (const id of ids) {
      gameAppearanceCount.set(id, (gameAppearanceCount.get(id) ?? 0) + 1);
    }
  }

  function passesPairwiseOverlap(proposedIds: string[]) {
    const proposed = new Set(proposedIds);
    for (const [otherSlug, otherSet] of seededListSets.entries()) {
      const intersection = Array.from(proposed).filter((id) => otherSet.has(id)).length;
      const union = new Set([...proposed, ...otherSet]).size;
      const similarity = union > 0 ? intersection / union : 0;
      if (similarity >= 0.5) {
        return { ok: false as const, conflictSlug: otherSlug, similarity: (similarity * 100).toFixed(0) };
      }
    }

    return { ok: true as const };
  }

  for (const seed of blueprints) {
    const previewText = seed.description;
    const bodyText = seed.description;
    const compare = seed.compare ?? compareByScore;
    const rankedPool = dedupeCanonicalGames(
      dedupePublicCanonicalRows(
        [...games]
          .filter(seed.matches)
          .sort(compare)
          .slice(0, 24)
      )
    ).sort(compare);

    if (rankedPool.length < 4) {
      results.push(`⚠️ Skipped "${seed.title}" because only ${rankedPool.length} strong matches passed the editorial rules.`);
      continue;
    }

    const allIds = rankedPool.map((game) => game.id);
    let constrainedIds = enforceOverlapConstraints(allIds, 3).slice(0, 12);

    if (constrainedIds.length < 4) {
      results.push(`⚠️ Skipped "${seed.title}" because only ${constrainedIds.length} games remained after overlap enforcement.`);
      continue;
    }

    const pairwiseCheck = passesPairwiseOverlap(constrainedIds);
    if (!pairwiseCheck.ok) {
      const stricterIds = enforceOverlapConstraints(allIds, 2).slice(0, 12);
      const recheck = passesPairwiseOverlap(stricterIds);
      if (!recheck.ok || stricterIds.length < 4) {
        results.push(`⚠️ Skipped "${seed.title}" because it overlapped too heavily with "${pairwiseCheck.conflictSlug}".`);
        continue;
      }
      constrainedIds = stricterIds;
    }

    const finalGames = constrainedIds
      .map((id) => rowsById.get(id))
      .filter(Boolean) as GameRow[];

    if (finalGames.length < 4) {
      results.push(`⚠️ Skipped "${seed.title}" because only ${finalGames.length} canonical matches remained after dedupe.`);
      continue;
    }

    const coverGame = finalGames.find((game) => game.header_image && !usedCoverImages.has(game.header_image))
      ?? finalGames.find((game) => game.header_image)
      ?? finalGames.find((game) => game.cover_image && !usedCoverImages.has(game.cover_image))
      ?? finalGames[0];
    const coverImage = coverGame?.header_image || coverGame?.cover_image || "";
    if (coverImage) {
      usedCoverImages.add(coverImage);
    }

    const seedHash = buildSeedHash({
      slug: seed.slug,
      title: seed.title,
      previewText,
      bodyText,
      tags: seed.tags,
    }, finalGames.map((game) => game.id));
    const seededAt = new Date().toISOString();
    const existingList = existingListsBySlug.get(seed.slug);

    if (existingList && !existingList.is_system_managed) {
      results.push(`⚠️ Skipped "${seed.title}" because slug "${seed.slug}" is owned by a non-system list.`);
      continue;
    }

    const listMutation = existingList
      ? supabase.from("lists")
        .update({
          title: seed.title,
          description: bodyText,
          preview_text: previewText,
          body_text: bodyText,
          cover_image: coverImage,
          tags: seed.tags,
          is_public: true,
          curated_by: SYSTEM_CURATOR,
          is_system_managed: true,
          system_key: seed.slug,
          managed_by: SYSTEM_LIST_MANAGER,
          seed_version: SYSTEM_LIST_SEED_VERSION,
          seed_hash: seedHash,
          last_seeded_at: seededAt,
        })
        .eq("id", existingList.id)
      : supabase.from("lists")
        .insert({
          slug: seed.slug,
          title: seed.title,
          description: bodyText,
          preview_text: previewText,
          body_text: bodyText,
          cover_image: coverImage,
          tags: seed.tags,
          is_public: true,
          curated_by: SYSTEM_CURATOR,
          is_system_managed: true,
          system_key: seed.slug,
          managed_by: SYSTEM_LIST_MANAGER,
          seed_version: SYSTEM_LIST_SEED_VERSION,
          seed_hash: seedHash,
          last_seeded_at: seededAt,
        });

    const { data: newList, error: listErr } = await listMutation
      .select("id")
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (listErr || !newList) {
      results.push(`❌ Failed to create "${seed.title}": ${listErr?.message ?? "unknown"}`);
      continue;
    }

    const { error: deleteItemsErr } = await supabase.from("list_items").delete().eq("list_id", newList.id);
    if (deleteItemsErr) {
      results.push(`❌ Failed to reset items for "${seed.title}": ${deleteItemsErr.message}`);
      continue;
    }

    const items = finalGames.map((game, index) => ({
      list_id: newList.id,
      game_id: game.id,
      position: index + 1,
    }));

    const { error: insertItemsErr } = await supabase.from("list_items").insert(items);
    if (insertItemsErr) {
      results.push(`❌ Failed to insert items for "${seed.title}": ${insertItemsErr.message}`);
      continue;
    }

    await writeAuditLog({
      entity_type: "list",
      entity_id: newList.id,
      action: existingList ? "update" : "create",
      field_changes: {
        title: { old: existingList?.title ?? null, new: seed.title },
        game_count: { old: null, new: finalGames.length },
        system_key: { old: existingList?.slug ?? null, new: seed.slug },
        seed_version: { old: existingList?.seed_version ?? null, new: SYSTEM_LIST_SEED_VERSION },
      },
      edited_by: editedBy,
    });

    existingListsBySlug.set(seed.slug, {
      id: newList.id,
      slug: seed.slug,
      title: seed.title,
      seed_version: SYSTEM_LIST_SEED_VERSION,
      is_system_managed: true,
    });
    recordAppearances(seed.slug, finalGames.map((game) => game.id));
    results.push(`✅ ${existingList ? "Updated" : "Created"} "${seed.title}" with ${finalGames.length} games`);
  }

  for (const stale of (staleListsRes.data ?? []) as Array<Pick<ListRow, "id" | "slug">>) {
    if (seedSlugs.includes(stale.slug)) {
      continue;
    }

    await supabase.from("list_items").delete().eq("list_id", stale.id);
    await supabase.from("lists").delete().eq("id", stale.id);
    results.push(`🗑 Removed stale list "${stale.slug}"`);
  }

  return results;
}
