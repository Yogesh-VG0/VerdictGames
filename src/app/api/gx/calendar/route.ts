import { jsonOk } from "@/lib/api/response";
import { getGXCalendar } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import type { GXCalendarGame } from "@/lib/types";

export const revalidate = 3600;

export async function GET() {
  const { data: raw } = await gxFetchWithCache(
    "calendar",
    getGXCalendar
  );
  const games: GXCalendarGame[] = raw.map((entry) => ({
    title: entry.game.title,
    slug: entry.game.slug,
    cover: entry.game.imageCoverVertical?.url ?? null,
    releaseDate: entry.release,
    hotGame: entry.hotGame ?? false,
    url: entry.url,
    ctaLabel: entry.cta?.label ?? null,
    genres: entry.game.genres.map((g) => g.name),
    platforms: entry.game.platforms.map((p) => p.name),
  }));
  return jsonOk(games);
}
