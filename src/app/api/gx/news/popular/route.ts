import { jsonError, jsonOk } from "@/lib/api/response";
import { getGXPopularNews } from "@/lib/external/gxcorner";
import { gxFetchWithCache } from "@/lib/external/gx-cache";
import {
  GX_NEWS_API_CACHE_CONTROL,
} from "@/lib/services/gx-feeds";
import type { GXNewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: raw, source } = await gxFetchWithCache(
    "news_popular",
    getGXPopularNews,
    1 * 60 * 60 * 1000 // 1 hour stale TTL
  );
  if (source === "empty") {
    return jsonError("Gaming news is temporarily unavailable.", 503);
  }
  const news: GXNewsItem[] = raw.map((a) => ({
    id: a.article_id,
    title: a.title,
    image: a.image,
    url: a.real_url || a.display_url,
    publisherName: a.publisher_name,
    publisherFavicon: a.publisher_favicon,
    related: a.related,
  }));
  return jsonOk(news, 200, { cacheControl: GX_NEWS_API_CACHE_CONTROL });
}
