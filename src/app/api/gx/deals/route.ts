import { jsonOk } from "@/lib/api/response";
import { getGXDeals } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import { getPublicSupabase, hasPublicSupabaseEnv } from "@/lib/supabase/public";
import type { GXDeal } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: raw } = await gxFetchWithCache(
    "deals",
    getGXDeals
  );
  const sourceSlugs = Array.from(
    new Set(raw.map((entry) => entry.game.slug).filter((slug): slug is string => Boolean(slug)))
  );
  const matchedSlugs = new Set<string>();

  if (hasPublicSupabaseEnv() && sourceSlugs.length > 0) {
    const supabase = getPublicSupabase();
    const { data: matchingGames } = await supabase
      .from("games")
      .select("slug")
      .in("slug", sourceSlugs);

    for (const game of matchingGames ?? []) {
      if (game.slug) {
        matchedSlugs.add(game.slug);
      }
    }
  }

  const deals: GXDeal[] = raw.map((entry) => ({
    id: entry.id,
    title: entry.game.title,
    cover: entry.game.imageCoverVertical?.url ?? null,
    gameSlug: entry.game.slug && matchedSlugs.has(entry.game.slug) ? entry.game.slug : null,
    discount: entry.game.prices?.[0]?.discount ?? null,
    price: entry.game.prices?.[0]?.price ?? null,
    currency: entry.game.prices?.[0]?.currency?.abbr ?? null,
    buyUrl: entry.game.prices?.[0]?.url ?? entry.url ?? null,
    storeName: entry.store?.name ?? null,
    storeColor: entry.store?.color ?? null,
    badge: entry.tag?.name ?? null,
    dealType: entry.dealType,
    genres: entry.game.genres.map((g) => g.name),
    platforms: entry.game.platforms.map((p) => p.name),
  }));
  return jsonOk(deals);
}
