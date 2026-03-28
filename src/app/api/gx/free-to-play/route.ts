import { jsonOk } from "@/lib/api/response";
import { getGXFreeToPlay } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import type { GXFreeGame } from "@/lib/types";

export const revalidate = 3600;

export async function GET() {
  const { data: raw } = await gxFetchWithCache(
    "free_to_play",
    getGXFreeToPlay
  );
  const games: GXFreeGame[] = raw.map((entry) => ({
    id: entry.id,
    title: entry.game.title,
    cover: entry.game.imageCoverVertical?.url ?? null,
    url: entry.url,
    ctaLabel: entry.cta?.label ?? null,
    genres: entry.game.genres.map((g) => g.name),
    platforms: entry.game.platforms.map((p) => p.name),
  }));
  return jsonOk(games);
}
