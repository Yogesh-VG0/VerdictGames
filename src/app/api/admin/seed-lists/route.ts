import { createHash } from "node:crypto";
import { jsonOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/auditLog";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import type { GameRow, ListRow } from "@/lib/supabase/types";

/* ── 12 editorial list definitions ── */
const SEED_LISTS = [
  {
    slug: "best-action-rpgs",
    title: "Best Action RPGs of All Time",
    description: "The ultimate collection of action RPGs that blend combat, exploration, and character progression into unforgettable experiences.",
    tags: ["action", "rpg"],
    query: "action rpg",
  },
  {
    slug: "cozy-games-to-relax",
    title: "Cozy Games to Unwind With",
    description: "Stress-free, relaxing games perfect for when you want to decompress after a long day.",
    tags: ["cozy", "relaxing"],
    query: "simulation",
  },
  {
    slug: "best-indie-gems",
    title: "Hidden Indie Gems",
    description: "Under-the-radar indie masterpieces that prove you don't need a big budget to make a great game.",
    tags: ["indie", "hidden gems"],
    query: "indie",
  },
  {
    slug: "essential-metroidvanias",
    title: "Essential Metroidvanias",
    description: "Interconnected worlds, ability-gated exploration, and tight combat — the best the genre has to offer.",
    tags: ["metroidvania", "platformer"],
    query: "metroidvania",
  },
  {
    slug: "top-open-world-adventures",
    title: "Top Open World Adventures",
    description: "Vast landscapes, emergent stories, and the freedom to explore at your own pace.",
    tags: ["open world", "adventure"],
    query: "open world",
  },
  {
    slug: "best-strategy-games",
    title: "Best Strategy Games",
    description: "Outsmart your opponents in these top-rated strategy titles spanning real-time, turn-based, and 4X.",
    tags: ["strategy", "tactical"],
    query: "strategy",
  },
  {
    slug: "survival-horror-essentials",
    title: "Survival Horror Essentials",
    description: "Heart-pounding horror games that will keep you on the edge of your seat.",
    tags: ["horror", "survival"],
    query: "horror",
  },
  {
    slug: "best-multiplayer-experiences",
    title: "Best Multiplayer Experiences",
    description: "Games that shine brightest when played with friends — from co-op adventures to competitive arenas.",
    tags: ["multiplayer", "co-op"],
    query: "multiplayer",
  },
  {
    slug: "critically-acclaimed-2024",
    title: "Critically Acclaimed in 2024",
    description: "The highest-rated games released in 2024, as scored by the Verdict algorithm.",
    tags: ["2024", "top rated"],
    query: "2024",
  },
  {
    slug: "best-roguelikes-roguelites",
    title: "Best Roguelikes & Roguelites",
    description: "Die, learn, repeat. The most addictive procedurally-generated adventures around.",
    tags: ["roguelike", "roguelite"],
    query: "roguelike",
  },
  {
    slug: "best-platformers",
    title: "Best Platformers",
    description: "From precision jumps to collectathons — the finest platforming experiences across every era.",
    tags: ["platformer", "2d"],
    query: "platformer",
  },
  {
    slug: "sci-fi-epics",
    title: "Sci-Fi Epics",
    description: "Explore the cosmos, battle alien threats, and unravel futuristic mysteries in these stellar sci-fi adventures.",
    tags: ["sci-fi", "space"],
    query: "sci-fi",
  },
];

const SYSTEM_LIST_MANAGER = "system-curated-lists";
const SYSTEM_LIST_SEED_VERSION = 2;

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

export async function POST() {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const supabase = getServerSupabase();
  const results: string[] = [];
  const usedCoverImages = new Set<string>();
  const seedSlugs = SEED_LISTS.map(s => s.slug);
  const { data: existingLists } = await supabase
    .from("lists")
    .select("id, slug, title, seed_version, is_system_managed")
    .in("slug", seedSlugs) as { data: Pick<ListRow, "id" | "slug" | "title" | "seed_version" | "is_system_managed">[] | null };
  const existingListsBySlug = new Map((existingLists ?? []).map((list) => [list.slug, list]));

  for (const seed of SEED_LISTS) {
    const previewText = seed.description;
    const bodyText = seed.description;

    // Fetch top-rated games with matching tags/genres
    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .gt("score", 0)
      .order("verdict_score", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false })
      .limit(200) as { data: GameRow[] | null };

    if (!gamesData || gamesData.length === 0) {
      results.push(`⚠️ No games found for "${seed.title}"`);
      continue;
    }

    // Filter and pick best matches (by genre/tag overlap with query keywords)
    const queryWords = seed.query.toLowerCase().split(/\s+/);
    const scored = gamesData
      .map(g => {
        let match = 0;
        const genresLower = (g.genres ?? []).map(x => x.toLowerCase());
        const tagsLower = (g.tags ?? []).map(x => x.toLowerCase());
        const descLower = (g.description ?? "").toLowerCase();
        for (const word of queryWords) {
          if (genresLower.some(x => x.includes(word))) match += 3;
          if (tagsLower.some(x => x.includes(word))) match += 2;
          if (descLower.includes(word)) match += 1;
        }
        // Bonus for having a header image (better for list thumbnail)
        if (g.header_image) match += 0.5;
        // Bonus for high review count (well-known games)
        if ((g.review_count ?? 0) > 1000) match += 1;
        return { game: g, match };
      })
      .filter(x => x.match > 0)
      .sort((a, b) => b.match - a.match || (b.game.score ?? 0) - (a.game.score ?? 0))
      .slice(0, 12);

    // If we don't have enough matches, just take top-rated games
    const candidateGames = scored.length >= 4
      ? scored.map(s => s.game)
      : gamesData;
    let finalGames = dedupePublicCanonicalRows(candidateGames).slice(0, 12);

    if (finalGames.length < 4 && scored.length >= 4) {
      finalGames = dedupePublicCanonicalRows(gamesData).slice(0, 12);
    }

    // Pick a unique cover image — prefer a game with a header_image not yet used by another list
    const coverGame = finalGames.find(g => g.header_image && g.header_image.length > 10 && !usedCoverImages.has(g.header_image))
      ?? finalGames.find(g => g.header_image && g.header_image.length > 10)
      ?? finalGames.find(g => g.cover_image && !usedCoverImages.has(g.cover_image ?? ""))
      ?? finalGames[0];
    const coverImage = coverGame?.header_image || coverGame?.cover_image || "";
    if (coverImage) usedCoverImages.add(coverImage);

    const seedHash = buildSeedHash({
      slug: seed.slug,
      title: seed.title,
      previewText,
      bodyText,
      tags: seed.tags,
    }, finalGames.map((g) => g.id));
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
          curated_by: "editorial",
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
          curated_by: "editorial",
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

    // Insert list items
    await supabase.from("list_items").delete().eq("list_id", newList.id);
    const items = finalGames.map((g, i) => ({
      list_id: newList.id,
      game_id: g.id,
      position: i + 1,
    }));

    await supabase.from("list_items").insert(items);

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
      edited_by: user?.email ?? "unknown",
    });

    results.push(`✅ ${existingList ? "Updated" : "Created"} "${seed.title}" with ${finalGames.length} games`);
  }

  return jsonOk({ results });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  return jsonOk({
    message: "POST to this endpoint to controlled-reseed the 12 system-owned editorial lists. User-owned lists are untouched.",
    lists: SEED_LISTS.map(l => ({ slug: l.slug, title: l.title })),
  });
}
