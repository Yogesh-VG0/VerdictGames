import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS } from "@/lib/db/columns";
import type { GameRow } from "@/lib/supabase/types";
import { slugify } from "@/lib/utils/slugify";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase.from("games").select(GAME_CARD_COLUMNS, { count: "planned" }) as any;

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count } = await query;

  return jsonOk({
    games: ((data ?? []) as GameRow[]).map(mapGameRow),
    total: count ?? 0,
    page,
    pageSize: limit,
  });
}

/** POST — Create a new game (3 modes: provisional, lookup, manual) */
export async function POST(request: NextRequest) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const body = await request.json();
  const supabase = getServerSupabase();

  // Mode 1: Ingest via title lookup
  if (body.mode === "lookup" && body.title) {
    const { ingestGame } = await import("@/lib/services/ingest");
    const result = await ingestGame({ query: body.title, expectedSlug: slugify(body.title) });
    if (result.success) {
      return jsonOk({ gameId: result.gameId, slug: result.slug, message: result.message });
    }
    // Surface low-confidence warning to the admin UI
    if ((result as { lowConfidence?: boolean }).lowConfidence) {
      return jsonError(result.message, 422);
    }
    return jsonError(result.message, 400);
  }

  // Mode 2: Ingest from mobile store (Google Play or App Store)
  if (body.mode === "mobile_store") {
    const storeSource: string = body.storeSource; // "google_play" | "app_store"
    const title: string = body.title?.trim();
    if (!title) return jsonError("Title is required", 400);

    const slug = body.slug || slugify(title);

    // Duplicate check
    const { data: existingSlug } = await supabase
      .from("games")
      .select("id, slug, title")
      .eq("slug", slug)
      .maybeSingle();
    if (existingSlug) {
      return jsonError(`A game with slug "${slug}" already exists: "${(existingSlug as { title: string }).title}"`, 409);
    }

    // Fetch full store details
    let coverImage = body.coverImage || "";
    let headerImage = "";
    let screenshots: string[] = [];
    let description = body.description || "";
    let developer = body.developer || "";
    let publisher = body.publisher || "";
    let platforms = body.platforms || [];
    let genres = body.genres || [];
    let monetization = "";
    let isFree = true;
    let playStoreUrl: string | null = null;
    let storeExternalId: string | null = null;
    let releaseDate: string | null = body.releaseDate || null;
    let storeScore: number | null = null;
    let storeRatings = 0;
    let trailerUrl: string | null = null;
    let trailerThumbnail: string | null = null;
    let websiteUrl: string | null = null;
    let contentRating: string | null = null;
    let storeUrl: string | null = null;
    // Cache fetched app data to avoid double-fetching for mobile_store_listings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fetchedGpApp: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fetchedAsApp: any = null;

    if (storeSource === "google_play" && body.appId) {
      try {
        const { getGooglePlayApp } = await import("@/lib/external/googleplay");
        const app = await getGooglePlayApp(body.appId);
        fetchedGpApp = app;
        if (app) {
          coverImage = coverImage || app.icon || "";
          headerImage = app.headerImage || "";
          screenshots = app.screenshots?.slice(0, 10) || [];
          // Use full description, fall back to summary
          description = description || app.description || app.summary || "";
          developer = developer || app.developer || "";
          publisher = publisher || app.developer || "";
          platforms = platforms.length ? platforms : ["Android"];
          genres = genres.length ? genres : [app.genre].filter(Boolean);
          monetization = app.free ? (app.offersIAP ? "Free + IAP" : "Free") : "Paid";
          isFree = app.free;
          playStoreUrl = app.url;
          storeExternalId = app.appId;
          storeUrl = app.url;
          releaseDate = releaseDate || app.released || null;
          storeScore = app.score;
          storeRatings = app.ratings || 0;
          // Trailer from Play Store video
          trailerUrl = app.video || app.previewVideo || null;
          trailerThumbnail = app.videoImage || app.headerImage || null;
          // Developer website
          websiteUrl = app.developerWebsite || null;
          contentRating = app.contentRating || null;
        }
      } catch (err) {
        console.warn("[admin/games] Google Play fetch failed:", (err as Error).message);
      }
    } else if (storeSource === "app_store" && body.trackId) {
      try {
        const { lookupAppStoreById } = await import("@/lib/external/appstore");
        const app = await lookupAppStoreById(body.trackId);
        fetchedAsApp = app;
        if (app) {
          coverImage = coverImage || app.artworkUrl512 || app.artworkUrl100 || "";
          screenshots = app.screenshotUrls?.slice(0, 10) || [];
          description = description || app.description || "";
          developer = developer || app.artistName || "";
          publisher = publisher || app.sellerName || app.artistName || "";
          platforms = platforms.length ? platforms : ["iOS"];
          genres = genres.length ? genres : app.genres?.length ? app.genres : [app.primaryGenreName].filter(Boolean);
          monetization = app.price === 0 ? "Free" : "Paid";
          isFree = app.price === 0;
          storeExternalId = String(app.trackId);
          storeUrl = app.trackViewUrl;
          releaseDate = releaseDate || (app.releaseDate ? app.releaseDate.split("T")[0] : null);
          storeScore = app.averageUserRating;
          storeRatings = app.userRatingCount || 0;
        }
      } catch (err) {
        console.warn("[admin/games] App Store fetch failed:", (err as Error).message);
      }
    }

    // Build verdict summary from store rating
    let verdictLabel = "COMING SOON";
    let score = 0;
    if (storeScore && storeRatings > 50) {
      score = Math.round(storeScore * 20); // 5-star → 0-100
      verdictLabel = score >= 85 ? "EXCEPTIONAL" : score >= 70 ? "GREAT" : score >= 55 ? "GOOD" : score >= 40 ? "MIXED" : "POOR";
    }

    // Truncate description to a reasonable size for DB
    const trimmedDescription = description.length > 4000 ? description.slice(0, 4000) + "..." : description;

    const record = {
      slug,
      title,
      subtitle: null,
      cover_image: coverImage,
      header_image: headerImage,
      screenshots,
      platforms,
      genres,
      tags: [],
      developer,
      publisher,
      release_date: releaseDate,
      description: trimmedDescription || "This game page is awaiting data enrichment.",
      score,
      verdict_label: verdictLabel,
      verdict_summary: storeScore ? `Rated ${storeScore.toFixed(1)}/5 by ${storeRatings.toLocaleString()} users on ${storeSource === "google_play" ? "Google Play" : "App Store"}.` : "",
      pros: [],
      cons: [],
      monetization,
      performance_notes: storeSource === "google_play" ? "Optimized for mobile devices. Performance varies by device." : "Optimized for iOS devices.",
      monetization_notes: "",
      review_count: storeRatings,
      featured: false,
      trending: false,
      score_source: "store_rating",
      enrichment_sources: [storeSource],
      price_currency: "USD",
      is_free: isFree,
      is_provisional: storeScore ? false : true,
      play_store_url: playStoreUrl,
      trailer_url: trailerUrl,
      trailer_thumbnail: trailerThumbnail,
      website_url: websiteUrl,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (supabase.from("games") as any)
      .insert(record)
      .select("*")
      .single() as { data: GameRow | null; error: { message: string } | null };

    if (error || !inserted) {
      return jsonError("Failed to create game: " + (error?.message ?? "Unknown error"), 500);
    }

    // Link in mobile_store_listings with full store metadata (reuses cached app data)
    if (storeExternalId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const listingData: Record<string, unknown> = {
          game_id: inserted.id,
          store: storeSource,
          external_id: storeExternalId,
          store_url: storeUrl,
          title,
          developer,
          icon_url: coverImage,
          header_image_url: headerImage || null,
          screenshots: screenshots.slice(0, 10),
          rating_average: storeScore,
          rating_count: storeRatings,
          is_verified: true,
          content_rating: contentRating,
          genre: genres[0] || null,
          is_free: isFree,
          price: 0,
          currency: "USD",
        };

        // Enrich from cached Google Play data (no re-fetch)
        if (fetchedGpApp) {
          listingData.installs = fetchedGpApp.installs || null;
          listingData.real_installs = fetchedGpApp.maxInstalls || null;
          listingData.review_count = fetchedGpApp.reviews || 0;
          listingData.genre_id = fetchedGpApp.genreId || null;
          listingData.version = fetchedGpApp.version || null;
          listingData.offers_iap = fetchedGpApp.offersIAP ?? false;
          listingData.iap_range = fetchedGpApp.inAppProductPrice || null;
          listingData.price = fetchedGpApp.price || 0;
          listingData.currency = fetchedGpApp.currency || "USD";
          listingData.released_at = fetchedGpApp.released || null;
          listingData.last_updated_at = fetchedGpApp.updated ? new Date(fetchedGpApp.updated).toISOString() : null;
        }

        // Enrich from cached App Store data (no re-fetch)
        if (fetchedAsApp) {
          listingData.review_count = fetchedAsApp.userRatingCount || 0;
          listingData.version = fetchedAsApp.version || null;
          listingData.content_rating = fetchedAsApp.contentAdvisoryRating || null;
          listingData.released_at = fetchedAsApp.releaseDate ? fetchedAsApp.releaseDate.split("T")[0] : null;
          listingData.last_updated_at = fetchedAsApp.currentVersionReleaseDate || null;
          listingData.price = fetchedAsApp.price || 0;
          listingData.currency = fetchedAsApp.currency || "USD";
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("mobile_store_listings") as any).upsert(
          listingData,
          { onConflict: "store,external_id" }
        );
      } catch { /* best-effort */ }
    }

    // Audit log
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("admin_audit_log") as any).insert({
        entity_type: "game",
        entity_id: inserted.id,
        action: "create",
        field_changes: { title: { old: null, new: title }, mode: "mobile_store", store: storeSource },
        edited_by: user?.email ?? "unknown",
      });
    } catch { /* best-effort */ }

    return jsonOk({ gameId: inserted.id, slug: inserted.slug, message: `Game "${title}" created from ${storeSource === "google_play" ? "Google Play" : "App Store"}.` });
  }

  // Mode 3: Ingest via source URL (extract title from URL slug)
  if (body.mode === "url" && body.url) {
    const parsedUrl = new URL(body.url);
    const urlSlug = parsedUrl.pathname.split("/").filter(Boolean).pop() ?? "";
    // Domain-specific title extraction
    let title = "";
    const host = parsedUrl.hostname.toLowerCase();
    if (host.includes("store.steampowered.com")) {
      // Steam URL: /app/123456/Game_Name/ → extract last segment
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      title = (segments[segments.length - 1] ?? "").replace(/_/g, " ");
    } else if (host.includes("rawg.io")) {
      // RAWG URL: /games/game-slug
      title = urlSlug.replace(/-/g, " ");
    } else if (host.includes("igdb.com")) {
      // IGDB URL: /games/game-slug
      title = urlSlug.replace(/-/g, " ").replace(/--/g, ": ");
    } else {
      title = urlSlug.replace(/[-_]/g, " ");
    }
    title = title.trim();
    if (!title) return jsonError("Could not extract title from URL", 400);
    const { ingestGame } = await import("@/lib/services/ingest");
    const result = await ingestGame({ query: title, expectedSlug: slugify(title) });
    if (result.success) {
      return jsonOk({ gameId: result.gameId, slug: result.slug, message: result.message });
    }
    if ((result as { lowConfidence?: boolean }).lowConfidence) {
      return jsonError(result.message, 422);
    }
    return jsonError(result.message, 400);
  }

  // Mode 3: Create provisional/manual entry
  if (!body.title) return jsonError("Title is required", 400);

  const slug = body.slug || slugify(body.title);

  // Duplicate check: slug
  const { data: existingSlug } = await supabase
    .from("games")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();
  if (existingSlug) {
    return jsonError(`A game with slug "${slug}" already exists: "${(existingSlug as { title: string }).title}"`, 409);
  }

  // Duplicate check: normalized title
  const normalTitle = body.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const { data: existingTitle } = await supabase
    .from("games")
    .select("id, slug, title")
    .ilike("title", body.title)
    .maybeSingle();
  if (existingTitle && slugify((existingTitle as { title: string }).title).replace(/-/g, "") === normalTitle) {
    return jsonError(`A game with title "${(existingTitle as { title: string }).title}" already exists`, 409);
  }

  const record = {
    slug,
    title: body.title,
    subtitle: body.subtitle || null,
    cover_image: body.coverImage || "",
    header_image: body.headerImage || "",
    screenshots: body.screenshots || [],
    platforms: body.platforms || [],
    genres: body.genres || [],
    tags: body.tags || [],
    developer: body.developer || "",
    publisher: body.publisher || "",
    release_date: body.releaseDate || null,
    description: body.description || "This game page is awaiting data enrichment.",
    score: 0,
    verdict_label: "COMING SOON",
    verdict_summary: "",
    pros: [],
    cons: [],
    monetization: "",
    performance_notes: "",
    monetization_notes: "",
    review_count: 0,
    featured: false,
    trending: false,
    score_source: "provisional",
    enrichment_sources: [],
    price_currency: "USD",
    is_free: false,
    is_provisional: true,
    release_status: body.releaseStatus || "upcoming",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase.from("games") as any)
    .insert(record)
    .select("*")
    .single() as { data: GameRow | null; error: { message: string } | null };

  if (error || !inserted) {
    return jsonError("Failed to create game: " + (error?.message ?? "Unknown error"), 500);
  }

  // Write audit log
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("admin_audit_log") as any).insert({
      entity_type: "game",
      entity_id: inserted.id,
      action: "create",
      field_changes: { title: { old: null, new: body.title }, mode: body.mode || "provisional" },
      edited_by: user?.email ?? "unknown",
    });
  } catch { /* audit log write is best-effort */ }

  return jsonOk({ gameId: inserted.id, slug: inserted.slug, message: `Game "${body.title}" created successfully.` });
}
