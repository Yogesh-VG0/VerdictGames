import { jsonOk } from "@/lib/api/response";
import { getGXDeals } from "@/lib/external/gxcorner";
import type { GXDeal } from "@/lib/types";

export const revalidate = 300;

export async function GET() {
  const raw = await getGXDeals();
  const deals: GXDeal[] = raw.map((entry) => ({
    id: entry.id,
    title: entry.game.title,
    cover: entry.game.imageCoverVertical?.url ?? null,
    discount: entry.game.prices?.[0]?.discount ?? null,
    price: entry.game.prices?.[0]?.price ?? null,
    currency: entry.game.prices?.[0]?.currency?.abbr ?? null,
    buyUrl: entry.game.prices?.[0]?.url ?? entry.url ?? null,
    storeName: entry.store?.name ?? null,
    storeColor: entry.store?.color ?? null,
    badge: entry.tag?.name ?? null,
    dealType: entry.dealType,
    genres: entry.game.genres.map((g) => g.name),
    platforms: entry.game.platforms.map((p) => p.name),
  }));
  return jsonOk(deals);
}
