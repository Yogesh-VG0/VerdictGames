import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  let source: string | undefined;
  try {
    const body = await request.json();
    source = body?.source;
  } catch {
    // No body is fine — defaults to full pipeline
  }

  try {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data: game } = await supabase
      .from("games")
      .select("title, slug")
      .eq("id", id)
      .maybeSingle();

    if (!game) return jsonError("Game not found", 404);

    const typedGame = game as { title: string; slug: string };

    // Source-specific enrichment: fetch data from a single source for comparison
    if (source === "igdb") {
      const { findIgdbMatch, extractIgdbEnrichment, isIgdbConfigured } = await import("@/lib/external/igdb");
      if (!isIgdbConfigured()) return jsonError("IGDB not configured (missing API keys)", 400);

      const igdbMatch = await findIgdbMatch(typedGame.title);
      if (!igdbMatch) return jsonOk({ success: false, message: "No IGDB match found", source: "igdb" });

      const enrichment = extractIgdbEnrichment(igdbMatch);
      return jsonOk({
        success: true,
        source: "igdb",
        preview: true,
        message: `Found IGDB match: ${igdbMatch.name}`,
        data: {
          igdbRating: enrichment.igdbRating,
          igdbUrl: enrichment.igdbUrl,
          trailerUrl: enrichment.trailerUrl,
          trailerThumbnail: enrichment.trailerThumbnail,
          summary: enrichment.igdbSummary,
          websiteUrl: enrichment.websiteUrl,
          wikipediaUrl: enrichment.wikipediaUrl,
          redditUrl: enrichment.redditUrl,
        },
      });
    }

    if (source === "rawg") {
      const { searchRawg, getRawgGame, mapRawgPlatforms } = await import("@/lib/external/rawg");
      const results = await searchRawg(typedGame.title, 1, 3);
      if (!results.results.length) return jsonOk({ success: false, message: "No RAWG match found", source: "rawg" });

      const best = results.results[0];
      const detail = await getRawgGame(best.id);

      return jsonOk({
        success: true,
        source: "rawg",
        preview: true,
        message: `Found RAWG match: ${best.name}`,
        data: {
          coverImage: best.background_image,
          platforms: mapRawgPlatforms(best.platforms),
          genres: (best.genres ?? []).map((g: { name: string }) => g.name),
          releaseDate: best.released,
          metacritic: best.metacritic,
          rating: best.rating,
          description: detail?.description_raw?.slice(0, 500) ?? "",
          developer: detail?.developers?.[0]?.name ?? "",
          publisher: detail?.publishers?.[0]?.name ?? "",
        },
      });
    }

    // Default: full pipeline re-ingest
    const { ingestGame } = await import("@/lib/services/ingest");
    const result = await ingestGame({
      query: typedGame.title,
      forceRefresh: true,
      expectedSlug: typedGame.slug,
    });

    return jsonOk(result);
  } catch (err) {
    return jsonError("Re-ingest failed: " + (err as Error).message, 500);
  }
}
