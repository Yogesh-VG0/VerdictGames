/**
 * VERDICT.GAMES — Admin: Backfill Prices
 *
 * POST /api/admin/backfill-prices
 *
 * Re-fetches pricing from Steam (with cc=us) for all games that have a
 * steam_app_id. Fixes stale currency data from before the cc=us fix.
 *
 * Processes in chunks to stay within Vercel's timeout.
 * Idempotent — safe to run multiple times.
 */

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { getSteamAppDetails, extractSteamPrice } from "@/lib/external/steam";

export async function POST(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const supabase = getServerSupabase();

  const url = new URL(request.url);
  const CHUNK = parseInt(url.searchParams.get("chunk") || "30", 10);

  // Fetch games with steam_app_id that still have non-USD currency
  const { data: games, error } = await supabase
    .from("games")
    .select("id, title, steam_app_id, price_currency, is_free")
    .not("steam_app_id", "is", null)
    .neq("price_currency", "USD")
    .order("id")
    .limit(CHUNK);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!games || games.length === 0) {
    return NextResponse.json({
      message: "No games with Steam App IDs found to update.",
      updated: 0,
    });
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const game of games) {
    try {
      if (!game.steam_app_id) {
        skipped++;
        continue;
      }

      const appData = await getSteamAppDetails(game.steam_app_id);
      if (!appData) {
        skipped++;
        continue;
      }

      const { priceCurrent, priceCurrency, isFree } = extractSteamPrice(appData);

      const { error: updateError } = await supabase
        .from("games")
        .update({
          price_current: priceCurrent,
          price_currency: priceCurrency,
          is_free: isFree,
        })
        .eq("id", game.id);

      if (updateError) {
        errors.push(`${game.title}: ${updateError.message}`);
        skipped++;
      } else {
        updated++;
      }

      // Rate limit: Steam API allows ~200 requests/5min, add small delay
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      errors.push(`${game.title}: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  // Count remaining games with non-USD currency
  const { count: remaining } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .not("steam_app_id", "is", null)
    .neq("price_currency", "USD");

  return NextResponse.json({
    message: remaining
      ? `Price backfill chunk done: ${updated} updated. ~${remaining} non-USD remaining — run again!`
      : `Price backfill complete: ${updated} updated. All prices in USD!`,
    updated,
    skipped,
    remaining: remaining ?? 0,
    errors: errors.slice(0, 10),
  });
}
