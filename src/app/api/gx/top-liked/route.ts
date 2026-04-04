import { jsonOk } from "@/lib/api/response";
import { getGXTopLiked } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import type { GXMostLiked } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  return jsonOk(games);
}
