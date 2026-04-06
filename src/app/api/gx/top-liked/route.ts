import { jsonOk } from "@/lib/api/response";
import { getGXTopLiked } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import {
  GX_FEEDS_API_CACHE_CONTROL,
  GX_FEEDS_REVALIDATE_SECONDS,
} from "@/lib/services/gx-feeds";
import type { GXMostLiked } from "@/lib/types";

export const revalidate = GX_FEEDS_REVALIDATE_SECONDS;

export async function GET() {
  const { data: raw } = await gxFetchWithCache(
    "top_liked",
    getGXTopLiked
  );
  const games: GXMostLiked[] = raw.map((g) => ({
    id: g.id,
    title: g.title,
    slug: g.slug,
    cover: g.imageSrc,
    url: g.url,
    releaseDate: g.releaseDate,
    likes: g.likesCount,
    genres: g.genres.map((ge) => ge.name),
  }));
  return jsonOk(games, 200, { cacheControl: GX_FEEDS_API_CACHE_CONTROL });
}
