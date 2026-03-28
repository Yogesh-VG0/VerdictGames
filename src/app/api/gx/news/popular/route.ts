import { jsonOk } from "@/lib/api/response";
import { getGXPopularNews } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import type { GXNewsItem } from "@/lib/types";

export const revalidate = 3600;

export async function GET() {
  const { data: raw } = await gxFetchWithCache(
    "news_popular",
    getGXPopularNews
  );
  const news: GXNewsItem[] = raw.map((a) => ({
    id: a.article_id,
    title: a.title,
    image: a.image,
    url: a.real_url,
    publisherName: a.publisher_name,
    publisherFavicon: a.publisher_favicon,
    related: a.related,
  }));
  return jsonOk(news);
}
