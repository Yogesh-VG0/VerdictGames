import { jsonOk } from "@/lib/api/response";
import { getGXTopGames } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import { slugify, titlesMatch } from "@/lib/utils/slugify";
import type { GXTopGame } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: raw } = await gxFetchWithCache(
    "top_games",
    getGXTopGames
  );
  const candidateSlugs = Array.from(
    new Set(
      raw.flatMap((entry) => {
        const sourceSlug = entry.game.slug?.trim();
        const titleSlug = slugify(entry.game.title);
        return [sourceSlug, titleSlug].filter((slug): slug is string => Boolean(slug));
      })
    )
  );
  const matchedGamesBySlug = new Map<string, { slug: string; title: string | null }>();

  if (hasPublicSupabaseEnv() && candidateSlugs.length > 0) {
    const supabase = getPublicSupabase();
    const { data: matchingGames } = await supabase
      .from("games")
      .select("slug, title")
      .in("slug", candidateSlugs);

    for (const game of matchingGames ?? []) {
      if (game.slug) {
        matchedGamesBySlug.set(game.slug, {
          slug: game.slug,
          title: typeof game.title === "string" ? game.title : null,
        });
      }
    }
  }

  const games: GXTopGame[] = raw.map((entry) => {
    const sourceSlug = entry.game.slug?.trim() ?? null;
    const titleSlug = slugify(entry.game.title);
    const sourceMatch = sourceSlug ? matchedGamesBySlug.get(sourceSlug) : undefined;
    const titleMatch = titleSlug ? matchedGamesBySlug.get(titleSlug) : undefined;
    const verifiedSlug = sourceMatch?.slug
      ?? (titleMatch?.title && titlesMatch(titleMatch.title, entry.game.title) ? titleMatch.slug : null);

    return {
      id: entry.id,
      title: entry.game.title,
      cover: entry.game.imageCoverVertical?.url ?? null,
      gameSlug: verifiedSlug,
      url: entry.url,
      serviceName: entry.store?.name ?? null,
      serviceColor: entry.store?.color ?? null,
      serviceTag: entry.tag?.name ?? null,
      genres: entry.game.genres.map((g) => g.name),
      platforms: entry.game.platforms.map((p) => p.name),
    };
  });
  return jsonOk(games);
}
