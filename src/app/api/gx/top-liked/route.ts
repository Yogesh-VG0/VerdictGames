import { jsonOk } from "@/lib/api/response";
import { getGXTopLiked } from "@/lib/external/gxcorner";
import type { GXMostLiked } from "@/lib/types";

export const revalidate = 300;

export async function GET() {
  const raw = await getGXTopLiked();
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
