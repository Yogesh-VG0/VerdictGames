import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { 
  optimizeHeaderImage, 
  needsOptimization,
  isCloudinaryUrl,
  isTrustedCdnUrl 
} from "@/lib/utils/image-optimize";

/**
 * POST /api/admin/backfill-header-images
 * 
 * Finds all games with external (non-IGDB/RAWG/Cloudinary) header images
 * and converts them to optimized Cloudinary fetch URLs.
 * 
 * Query params:
 * - dryRun=true: Preview changes without applying them
 * - limit=N: Process only first N games (default: all)
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';
  const limit = parseInt(searchParams.get('limit') || '0', 10);

  const supabase = getServerSupabase();

  try {
    // Find games with non-empty header images that need optimization
    let query = supabase
      .from("games")
      .select("id, slug, title, header_image")
      .not("header_image", "is", null)
      .neq("header_image", "");

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data: games, error: fetchError } = await query;

    if (fetchError) {
      return jsonError(`Failed to fetch games: ${fetchError.message}`, 500);
    }

    if (!games || games.length === 0) {
      return jsonOk({
        message: "No games with header images found",
        processed: 0,
        optimized: 0,
        skipped: 0,
      });
    }

    const results: {
      optimized: Array<{ slug: string; title: string; originalUrl: string; optimizedUrl: string }>;
      skipped: Array<{ slug: string; title: string; url: string; reason: string }>;
      errors: Array<{ slug: string; title: string; error: string }>;
    } = {
      optimized: [],
      skipped: [],
      errors: [],
    };

    for (const game of games) {
      const headerImage = game.header_image as string;

      // Check if optimization is needed
      if (!needsOptimization(headerImage)) {
        let reason = "Unknown";
        if (isCloudinaryUrl(headerImage)) {
          reason = "Already Cloudinary URL";
        } else if (isTrustedCdnUrl(headerImage)) {
          reason = "Trusted CDN (IGDB/RAWG/Steam)";
        } else if (!headerImage.trim()) {
          reason = "Empty URL";
        }
        results.skipped.push({
          slug: game.slug,
          title: game.title,
          url: headerImage,
          reason,
        });
        continue;
      }

      try {
        const optimizedUrl = optimizeHeaderImage(headerImage);

        if (!dryRun) {
          // Update the database
          const { error: updateError } = await supabase
            .from("games")
            .update({ 
              header_image: optimizedUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", game.id);

          if (updateError) {
            results.errors.push({
              slug: game.slug,
              title: game.title,
              error: updateError.message,
            });
            continue;
          }
        }

        results.optimized.push({
          slug: game.slug,
          title: game.title,
          originalUrl: headerImage,
          optimizedUrl,
        });
      } catch (err) {
        results.errors.push({
          slug: game.slug,
          title: game.title,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return jsonOk({
      message: dryRun 
        ? `Dry run complete. Would optimize ${results.optimized.length} header images.`
        : `Backfill complete. Optimized ${results.optimized.length} header images.`,
      dryRun,
      processed: games.length,
      optimized: results.optimized.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
      details: results,
    });
  } catch (err) {
    console.error("[Admin BackfillHeaderImages] Error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Backfill failed",
      500
    );
  }
}

/**
 * GET /api/admin/backfill-header-images
 * 
 * Preview which games would be affected by the backfill
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const supabase = getServerSupabase();

  try {
    // Find games with header images that need optimization
    const { data: games, error: fetchError } = await supabase
      .from("games")
      .select("id, slug, title, header_image, updated_at")
      .not("header_image", "is", null)
      .neq("header_image", "")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      return jsonError(`Failed to fetch games: ${fetchError.message}`, 500);
    }

    const analysis = {
      total: games?.length || 0,
      needsOptimization: 0,
      alreadyOptimized: 0,
      trustedCdn: 0,
      games: [] as Array<{
        slug: string;
        title: string;
        headerImage: string;
        status: string;
        optimizedPreview?: string;
      }>,
    };

    for (const game of games || []) {
      const headerImage = game.header_image as string;
      let status = "needs_optimization";
      let optimizedPreview: string | undefined;

      if (isCloudinaryUrl(headerImage)) {
        status = "already_cloudinary";
        analysis.alreadyOptimized++;
      } else if (isTrustedCdnUrl(headerImage)) {
        status = "trusted_cdn";
        analysis.trustedCdn++;
      } else if (needsOptimization(headerImage)) {
        status = "needs_optimization";
        optimizedPreview = optimizeHeaderImage(headerImage);
        analysis.needsOptimization++;
      }

      analysis.games.push({
        slug: game.slug,
        title: game.title,
        headerImage,
        status,
        optimizedPreview,
      });
    }

    return jsonOk(analysis);
  } catch (err) {
    console.error("[Admin BackfillHeaderImages] Error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Analysis failed",
      500
    );
  }
}
