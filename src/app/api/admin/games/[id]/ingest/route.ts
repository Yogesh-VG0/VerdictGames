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

    // Source-specific enrichment: fetch data and apply to the game record
    if (source === "igdb") {
      const { findIgdbMatch, extractIgdbEnrichment, isIgdbConfigured } = await import("@/lib/external/igdb");
      if (!isIgdbConfigured()) return jsonError("IGDB not configured (missing API keys)", 400);

      const igdbMatch = await findIgdbMatch(typedGame.title);
      if (!igdbMatch) return jsonOk({ success: false, message: "No IGDB match found", source: "igdb" });

      const enrichment = extractIgdbEnrichment(igdbMatch);

      // Build update payload from IGDB data (only non-empty fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const igdbUpdates: Record<string, any> = {};
      if (enrichment.igdbRating && enrichment.igdbRating > 0) igdbUpdates.igdb_score = enrichment.igdbRating;
      if (enrichment.igdbUrl) igdbUpdates.igdb_url = enrichment.igdbUrl;
      if (enrichment.trailerUrl) igdbUpdates.trailer_url = enrichment.trailerUrl;
      if (enrichment.trailerThumbnail) igdbUpdates.trailer_thumbnail = enrichment.trailerThumbnail;
      if (enrichment.igdbSummary) igdbUpdates.description = enrichment.igdbSummary;
      if (enrichment.websiteUrl) igdbUpdates.website_url = enrichment.websiteUrl;
      if (enrichment.wikipediaUrl) igdbUpdates.wikipedia_url = enrichment.wikipediaUrl;
      if (enrichment.redditUrl) igdbUpdates.reddit_url = enrichment.redditUrl;

      if (Object.keys(igdbUpdates).length > 0) {
        igdbUpdates.updated_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("games") as any).update(igdbUpdates).eq("id", id);
      }

      return jsonOk({
        success: true,
        source: "igdb",
        message: `Applied IGDB data from: ${igdbMatch.name} (${Object.keys(igdbUpdates).length - 1} fields updated)`,
        data: {
          igdbRating: enrichment.igdbRating,
          igdbUrl: enrichment.igdbUrl,
          trailerUrl: enrichment.trailerUrl,
          trailerThumbnail: enrichment.trailerThumbnail,
          summary: enrichment.igdbSummary,
          websiteUrl: enrichment.websiteUrl,
          wikipediaUrl: enrichment.wikipediaUrl,
          redditUrl: enrichment.redditUrl,
          fieldsUpdated: Object.keys(igdbUpdates).filter(k => k !== "updated_at"),
        },
      });
    }

    if (source === "rawg") {
      const { searchRawg, getRawgGame, mapRawgPlatforms } = await import("@/lib/external/rawg");
      const results = await searchRawg(typedGame.title, 1, 3);
      if (!results.results.length) return jsonOk({ success: false, message: "No RAWG match found", source: "rawg" });

      const best = results.results[0];
      const detail = await getRawgGame(best.id);

      // Build update payload from RAWG data (only non-empty fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawgUpdates: Record<string, any> = {};
      if (best.background_image) rawgUpdates.cover_image = best.background_image;
      if (best.platforms) rawgUpdates.platforms = mapRawgPlatforms(best.platforms);
      if (best.genres?.length) rawgUpdates.genres = best.genres.map((g: { name: string }) => g.name);
      if (best.released) rawgUpdates.release_date = best.released;
      if (best.metacritic) rawgUpdates.metacritic_score = best.metacritic;
      if (detail?.description_raw) rawgUpdates.description = detail.description_raw.slice(0, 2000);
      if (detail?.developers?.[0]?.name) rawgUpdates.developer = detail.developers[0].name;
      if (detail?.publishers?.[0]?.name) rawgUpdates.publisher = detail.publishers[0].name;
      if (detail?.website) rawgUpdates.website_url = detail.website;
      // Use short_screenshots from search result for header image and screenshots
      if (best.short_screenshots && best.short_screenshots.length > 1) {
        rawgUpdates.header_image = best.short_screenshots[1].image;
        rawgUpdates.screenshots = best.short_screenshots.slice(1, 7).map((s) => s.image);
      }

      if (Object.keys(rawgUpdates).length > 0) {
        rawgUpdates.updated_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("games") as any).update(rawgUpdates).eq("id", id);
      }

      return jsonOk({
        success: true,
        source: "rawg",
        message: `Applied RAWG data from: ${best.name} (${Object.keys(rawgUpdates).length - 1} fields updated)`,
        data: {
          coverImage: best.background_image,
          platforms: rawgUpdates.platforms,
          genres: rawgUpdates.genres,
          releaseDate: best.released,
          metacritic: best.metacritic,
          description: rawgUpdates.description?.slice(0, 500) ?? "",
          developer: rawgUpdates.developer ?? "",
          publisher: rawgUpdates.publisher ?? "",
          fieldsUpdated: Object.keys(rawgUpdates).filter(k => k !== "updated_at"),
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
