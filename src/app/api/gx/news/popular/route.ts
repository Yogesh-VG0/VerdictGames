import { jsonOk } from "@/lib/api/response";
import { getGXPopularNews } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import type { GXNewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  // News uses fresher 1-hour stale policy (vs 6h default for calendar/deals)
  const { data: raw } = await gxFetchWithCache(
    "news_popular",
    getGXPopularNews,
    1 * 60 * 60 * 1000 // 1 hour stale TTL
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
