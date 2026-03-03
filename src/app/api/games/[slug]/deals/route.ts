/**
 * GET /api/games/[slug]/deals
 *
 * Returns current deals and price data for a game.
 * Sources: CheapShark, Steam.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api/response";
import { getCheapSharkGame, getCheapSharkDeals, getStoreName } from "@/lib/external/cheapshark";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonOk({ deals: [], priceCurrent: null, priceLowest: null });
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    // Fetch game to get cheapshark_id and steam_app_id
    const { data: game } = await supabase
      .from("games")
      .select("cheapshark_id, steam_app_id, price_current, price_lowest, price_currency, is_free, title")
      .eq("slug", slug)
      .maybeSingle() as { data: Pick<GameRow, "cheapshark_id" | "steam_app_id" | "price_current" | "price_lowest" | "price_currency" | "is_free" | "title"> | null };

    if (!game) return jsonNotFound("Game");

    // Fetch live deals from CheapShark
    let deals: { store: string; price: string; retailPrice: string; savings: string; dealUrl: string }[] = [];

    if (game.cheapshark_id) {
      const gameInfo = await getCheapSharkGame(game.cheapshark_id);
      if (gameInfo?.deals) {
        deals = gameInfo.deals.map((d) => ({
          store: getStoreName(d.storeID),
          price: `$${d.price}`,
          retailPrice: `$${d.retailPrice}`,
          savings: `${Math.round(parseFloat(d.savings))}%`,
          dealUrl: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
        }));
      }
    } else if (game.steam_app_id) {
      // Fallback: get deals by Steam App ID
      const steamDeals = await getCheapSharkDeals({ steamAppId: game.steam_app_id });
      deals = steamDeals.slice(0, 10).map((d) => ({
        store: getStoreName(d.storeID),
        price: `$${d.salePrice}`,
        retailPrice: `$${d.normalPrice}`,
        savings: `${Math.round(parseFloat(d.savings))}%`,
        dealUrl: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
      }));
    }

    return jsonOk({
      title: game.title,
      priceCurrent: game.price_current,
      priceLowest: game.price_lowest,
      priceCurrency: game.price_currency ?? "USD",
      isFree: game.is_free ?? false,
      deals,
    });
  } catch (err) {
    console.error(`[API] /games/${slug}/deals error:`, err);
    return jsonError("Failed to fetch deals.");
  }
}
