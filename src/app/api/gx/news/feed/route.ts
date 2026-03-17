import { jsonOk } from "@/lib/api/response";
import { getGXNewsFeed } from "@/lib/external/gxcorner";
import type { GXNewsItem } from "@/lib/types";

export const revalidate = 300;

export async function GET() {
  const raw = await getGXNewsFeed();
  const news: GXNewsItem[] = raw.map((a) => ({
    id: a.article_id,
    title: a.title,
    image: a.image,
    url: a.real_url,
    publisherName: a.publisher_name,
    publisherFavicon: a.publisher_favicon,
  }));
  return jsonOk(news);
}
