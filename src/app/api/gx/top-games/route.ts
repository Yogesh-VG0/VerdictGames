import { jsonOk } from "@/lib/api/response";
import { getGXTopGames } from "@/lib/external/gxcorner";
import type { GXTopGame } from "@/lib/types";

export const revalidate = 3600;

export async function GET() {
  const raw = await getGXTopGames();
  const games: GXTopGame[] = raw.map((entry) => ({
    id: entry.id,
    title: entry.game.title,
    cover: entry.game.imageCoverVertical?.url ?? null,
    url: entry.url,
    serviceName: entry.store?.name ?? null,
    serviceColor: entry.store?.color ?? null,
    serviceTag: entry.tag?.name ?? null,
    genres: entry.game.genres.map((g) => g.name),
    platforms: entry.game.platforms.map((p) => p.name),
  }));
  return jsonOk(games);
}
