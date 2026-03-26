/**
 * GET /api/admin/games/search-preview?q=elden+ring
 *
 * Returns RAWG search results as preview candidates for admin game ingestion.
 * Does NOT ingest — just returns metadata so admin can pick the right game.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError, jsonBadRequest } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { searchRawg } from "@/lib/external/rawg";
import { getServerSupabase } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slugify";

export async function GET(request: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return jsonBadRequest("Missing query parameter ?q=");

  try {
    const rawgResults = await searchRawg(q, 1, 8);

    // Check which slugs already exist in our DB
    const supabase = getServerSupabase();
    const candidateSlugs = rawgResults.results.map((r) => slugify(r.name));
    const rawgSlugs = rawgResults.results.map((r) => r.slug);
    const allSlugs = [...new Set([...candidateSlugs, ...rawgSlugs])];

    const { data: existingGames } = await supabase
      .from("games")
      .select("slug, title")
      .in("slug", allSlugs);

    const existingSlugSet = new Set((existingGames ?? []).map((g) => g.slug));

    const candidates = rawgResults.results.map((r) => ({
      rawgId: r.id,
      name: r.name,
      slug: r.slug,
      released: r.released,
      backgroundImage: r.background_image,
      rating: r.rating,
      ratingsCount: r.ratings_count,
      metacritic: r.metacritic,
      platforms: (r.platforms ?? []).map((p) => p.platform.name),
      genres: (r.genres ?? []).map((g) => g.name),
      alreadyInDb: existingSlugSet.has(r.slug) || existingSlugSet.has(slugify(r.name)),
    }));

    return jsonOk({ candidates, total: rawgResults.count });
  } catch (err) {
    return jsonError(`RAWG search failed: ${(err as Error).message}`, 502);
  }
}
