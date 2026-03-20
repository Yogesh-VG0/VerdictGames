import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/auditLog";
import type { GameRow } from "@/lib/supabase/types";

/* ── 10 editorial list definitions ── */
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
];

export async function POST() {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const supabase = getServerSupabase();
  const results: string[] = [];

  for (const seed of SEED_LISTS) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("lists")
      .select("id")
      .eq("slug", seed.slug)
      .maybeSingle();

    if (existing) {
      results.push(`⏭️ "${seed.title}" already exists`);
      continue;
    }

    // Fetch top-rated games with matching tags/genres
    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .order("score", { ascending: false })
      .limit(100) as { data: GameRow[] | null };

    if (!gamesData || gamesData.length === 0) {
      results.push(`⚠️ No games found for "${seed.title}"`);
      continue;
    }

    // Filter and pick best matches (by genre/tag overlap with query)
    const queryLower = seed.query.toLowerCase();
    const scored = gamesData
      .map(g => {
        let match = 0;
        const genresLower = (g.genres ?? []).map(x => x.toLowerCase());
        const tagsLower = (g.tags ?? []).map(x => x.toLowerCase());
        if (genresLower.some(x => x.includes(queryLower))) match += 3;
        if (tagsLower.some(x => x.includes(queryLower))) match += 2;
        if ((g.description ?? "").toLowerCase().includes(queryLower)) match += 1;
        return { game: g, match };
      })
      .filter(x => x.match > 0)
      .sort((a, b) => b.match - a.match || (b.game.score ?? 0) - (a.game.score ?? 0))
      .slice(0, 8);

    // If we don't have enough matches, just take top-rated games
    const finalGames = scored.length >= 4
      ? scored.map(s => s.game)
      : gamesData.slice(0, 8);

    // Create the list
    const coverImage = finalGames[0]?.header_image || finalGames[0]?.cover_image || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newList, error: listErr } = await (supabase.from("lists") as any)
      .insert({
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
        cover_image: coverImage,
        tags: seed.tags,
        is_public: true,
        curated_by: "Verdict.games Editorial",
      })
      .select("id")
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (listErr || !newList) {
      results.push(`❌ Failed to create "${seed.title}": ${listErr?.message ?? "unknown"}`);
      continue;
    }

    // Insert list items
    const items = finalGames.map((g, i) => ({
      list_id: newList.id,
      game_id: g.id,
      position: i,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("list_items") as any).insert(items);

    await writeAuditLog({
      entity_type: "list",
      entity_id: newList.id,
      action: "create",
      field_changes: { title: { old: null, new: seed.title }, game_count: { old: null, new: finalGames.length } },
      edited_by: user?.email ?? "unknown",
    });

    results.push(`✅ Created "${seed.title}" with ${finalGames.length} games`);
  }

  return jsonOk({ results });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  return jsonOk({
    message: "POST to this endpoint to seed 10 editorial curated lists",
    lists: SEED_LISTS.map(l => ({ slug: l.slug, title: l.title })),
  });
}
