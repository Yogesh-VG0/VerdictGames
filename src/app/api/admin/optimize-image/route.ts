import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { 
  buildOptimizedUrl, 
  needsOptimization, 
  getOptimizedImageInfo,
  IMAGE_PRESETS 
} from "@/lib/utils/image-optimize";

type ImagePreset = keyof typeof IMAGE_PRESETS;

/**
 * POST /api/admin/optimize-image
 * 
 * Converts external image URLs to optimized Cloudinary fetch URLs.
 * This doesn't upload the image, it creates a URL that will fetch
 * and transform the image on-the-fly through Cloudinary CDN.
 * 
 * Body: { url: string, preset?: 'hero' | 'cover' | 'screenshot' }
 * Returns: { originalUrl, optimizedUrl, isOptimized, ...info }
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { url, preset = 'hero' } = body as { url: string; preset?: ImagePreset };

    if (!url || typeof url !== 'string') {
      return jsonError("URL is required", 400);
    }

    // Validate preset
    if (!IMAGE_PRESETS[preset]) {
      return jsonError(`Invalid preset. Must be one of: ${Object.keys(IMAGE_PRESETS).join(', ')}`, 400);
    }

    // Check if optimization is needed
    if (!needsOptimization(url)) {
      return jsonOk({
        originalUrl: url,
        optimizedUrl: url,
        isOptimized: false,
        reason: "URL is already from Cloudinary or a trusted CDN",
      });
    }

    // Get optimization info
    const info = getOptimizedImageInfo(url, preset);

    return jsonOk(info);
  } catch (err) {
    console.error("[Admin OptimizeImage] Error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to optimize image",
      500
    );
  }
}

/**
 * GET /api/admin/optimize-image
 * 
 * Preview endpoint - returns info about how an image would be optimized
 * Query: ?url=...&preset=hero
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const preset = (searchParams.get('preset') || 'hero') as ImagePreset;

  if (!url) {
    return jsonError("URL query parameter is required", 400);
  }

  if (!IMAGE_PRESETS[preset]) {
    return jsonError(`Invalid preset. Must be one of: ${Object.keys(IMAGE_PRESETS).join(', ')}`, 400);
  }

  const optimizedUrl = buildOptimizedUrl(url, preset);
  const info = getOptimizedImageInfo(url, preset);

  return jsonOk(info);
}
