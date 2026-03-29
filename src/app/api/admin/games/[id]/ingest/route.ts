import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { writeAuditLog } from "@/lib/auditLog";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  let source: string | undefined;
  let forceOverwrite = false;
  try {
    const body = await request.json();
    source = body?.source;
    forceOverwrite = body?.forceOverwrite === true;
  } catch {
    // No body is fine — defaults to full pipeline
  }

  try {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data: game } = await supabase
      .from("games")
      .select("title, slug, release_date")
      .eq("id", id)
      .maybeSingle();

    if (!game) return jsonError("Game not found", 404);

    const typedGame = game as { title: string; slug: string; release_date: string | null };
    const releaseYear = typedGame.release_date ? new Date(typedGame.release_date).getFullYear() : undefined;

    // Source-specific enrichment: fetch data and apply to the game record
    if (source === "igdb") {
      const { findIgdbMatch, extractIgdbEnrichment, isIgdbConfigured, getIgdbGame } = await import("@/lib/external/igdb");
      if (!isIgdbConfigured()) return jsonError("IGDB not configured (missing API keys)", 400);

      const igdbMatch = await findIgdbMatch(typedGame.title, releaseYear);
      if (!igdbMatch) return jsonOk({ success: false, message: "No IGDB match found", source: "igdb" });

      // Do a full game fetch to get all expanded fields (screenshots, cover, etc.)
      // Search results often don't include nested expansions properly
      const fullGame = await getIgdbGame(igdbMatch.id);
      const enrichment = extractIgdbEnrichment(fullGame ?? igdbMatch);

      // Build update payload from IGDB data (only non-empty fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const igdbUpdates: Record<string, any> = {};
      if (enrichment.igdbRating && enrichment.igdbRating > 0) igdbUpdates.igdb_rating = enrichment.igdbRating;
      if (enrichment.igdbUrl) igdbUpdates.igdb_url = enrichment.igdbUrl;
      if (enrichment.trailerUrl) igdbUpdates.trailer_url = enrichment.trailerUrl;
      if (enrichment.trailerThumbnail) igdbUpdates.trailer_thumbnail = enrichment.trailerThumbnail;
      if (enrichment.igdbSummary) igdbUpdates.description = enrichment.igdbSummary;
      if (enrichment.websiteUrl) igdbUpdates.website_url = enrichment.websiteUrl;
      if (enrichment.wikipediaUrl) igdbUpdates.wikipedia_url = enrichment.wikipediaUrl;
      if (enrichment.redditUrl) igdbUpdates.reddit_url = enrichment.redditUrl;
      if (enrichment.coverImageUrl) igdbUpdates.cover_image = enrichment.coverImageUrl;
      if (enrichment.screenshotUrls.length > 0) {
        igdbUpdates.screenshots = enrichment.screenshotUrls;
        igdbUpdates.header_image = enrichment.screenshotUrls[0];
      }

      const fieldsToUpdate = Object.keys(igdbUpdates).filter(k => k !== "updated_at");

      if (Object.keys(igdbUpdates).length > 0) {
        // Fetch old values for audit diff
        const { data: oldGame } = await supabase.from("games").select("*").eq("id", id).maybeSingle();

        igdbUpdates.updated_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("games") as any).update(igdbUpdates).eq("id", id);
        if (updateError) {
          return jsonError(`IGDB data fetched but DB update failed: ${updateError.message}`, 500);
        }

        // Write audit log for reingest changes
        if (oldGame) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fieldChanges: Record<string, { old: any; new: any }> = {};
          for (const key of fieldsToUpdate) {
            const oldVal = (oldGame as Record<string, unknown>)[key];
            const newVal = igdbUpdates[key];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              fieldChanges[key] = { old: oldVal, new: newVal };
            }
          }
          if (Object.keys(fieldChanges).length > 0) {
            await writeAuditLog({
              entity_type: "game",
              entity_id: id,
              action: "update",
              field_changes: fieldChanges,
              edited_by: user?.email ?? "unknown",
              reason: `IGDB reingest: ${igdbMatch.name}`,
            });
          }
        }
      }

      return jsonOk({
        success: true,
        source: "igdb",
        message: `Applied IGDB data from: ${igdbMatch.name} (${fieldsToUpdate.length} fields updated)`,
        data: {
          igdbRating: enrichment.igdbRating,
          igdbUrl: enrichment.igdbUrl,
          trailerUrl: enrichment.trailerUrl,
          trailerThumbnail: enrichment.trailerThumbnail,
          summary: enrichment.igdbSummary,
          websiteUrl: enrichment.websiteUrl,
          wikipediaUrl: enrichment.wikipediaUrl,
          redditUrl: enrichment.redditUrl,
          coverImage: enrichment.coverImageUrl,
          screenshots: enrichment.screenshotUrls,
          fieldsUpdated: fieldsToUpdate,
        },
      });
    }

    if (source === "rawg") {
      const { searchRawg, getRawgGame, mapRawgPlatforms } = await import("@/lib/external/rawg");
      const { findIgdbMatch, extractIgdbEnrichment, isIgdbConfigured, getIgdbGame } = await import("@/lib/external/igdb");
      
      const results = await searchRawg(typedGame.title, 1, 3);
      if (!results.results.length) return jsonOk({ success: false, message: "No RAWG match found", source: "rawg" });

      const best = results.results[0];
      const detail = await getRawgGame(best.id);

      // ══════════════════════════════════════════════════
      // COVER IMAGE PRIORITY: IGDB first, then RAWG
      // Even when doing "RAWG reingest", we still prefer IGDB covers
      // ══════════════════════════════════════════════════
      let coverImage: string | null = null;
      let igdbCoverUsed = false;
      
      // Try IGDB cover first (best quality)
      if (isIgdbConfigured()) {
        try {
          const igdbMatch = await findIgdbMatch(typedGame.title, releaseYear);
          if (igdbMatch) {
            const fullIgdb = await getIgdbGame(igdbMatch.id);
            const igdbEnrich = extractIgdbEnrichment(fullIgdb ?? igdbMatch);
            if (igdbEnrich.coverImageUrl) {
              coverImage = igdbEnrich.coverImageUrl;
              igdbCoverUsed = true;
            }
          }
        } catch (e) {
          console.warn("[RAWG reingest] IGDB cover check failed:", (e as Error).message);
        }
      }
      
      // Fallback to RAWG cover
      if (!coverImage && best.background_image) {
        coverImage = best.background_image;
      }

      // Build update payload from RAWG data (only non-empty fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawgUpdates: Record<string, any> = {};
      if (coverImage) {
        rawgUpdates.cover_image = coverImage;
        rawgUpdates.media_source = igdbCoverUsed ? "igdb" : "rawg";
      }
      if (best.platforms) rawgUpdates.platforms = mapRawgPlatforms(best.platforms);
      if (best.genres?.length) rawgUpdates.genres = best.genres.map((g: { name: string }) => g.name);
      if (best.released) rawgUpdates.release_date = best.released;
      if (best.metacritic) rawgUpdates.rawg_metacritic = best.metacritic;
      if (detail?.description_raw) rawgUpdates.description = detail.description_raw.slice(0, 2000);
      if (detail?.developers?.[0]?.name) rawgUpdates.developer = detail.developers[0].name;
      if (detail?.publishers?.[0]?.name) rawgUpdates.publisher = detail.publishers[0].name;
      if (detail?.website) rawgUpdates.website_url = detail.website;
      // Use short_screenshots from search result for header image and screenshots
      if (best.short_screenshots && best.short_screenshots.length > 1) {
        rawgUpdates.header_image = best.short_screenshots[1].image;
        rawgUpdates.screenshots = best.short_screenshots.slice(1, 7).map((s) => s.image);
      }

      const rawgFieldsToUpdate = Object.keys(rawgUpdates).filter(k => k !== "updated_at");

      if (Object.keys(rawgUpdates).length > 0) {
        // Fetch old values for audit diff
        const { data: oldGame } = await supabase.from("games").select("*").eq("id", id).maybeSingle();

        rawgUpdates.updated_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("games") as any).update(rawgUpdates).eq("id", id);
        if (updateError) {
          return jsonError(`RAWG data fetched but DB update failed: ${updateError.message}`, 500);
        }

        // Write audit log for reingest changes
        if (oldGame) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fieldChanges: Record<string, { old: any; new: any }> = {};
          for (const key of rawgFieldsToUpdate) {
            const oldVal = (oldGame as Record<string, unknown>)[key];
            const newVal = rawgUpdates[key];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              fieldChanges[key] = { old: oldVal, new: newVal };
            }
          }
          if (Object.keys(fieldChanges).length > 0) {
            await writeAuditLog({
              entity_type: "game",
              entity_id: id,
              action: "update",
              field_changes: fieldChanges,
              edited_by: user?.email ?? "unknown",
              reason: `RAWG reingest: ${best.name}`,
            });
          }
        }
      }

      return jsonOk({
        success: true,
        source: "rawg",
        message: `Applied RAWG data from: ${best.name} (${rawgFieldsToUpdate.length} fields updated)`,
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

    // ── Google Play re-ingest ──
    if (source === "google_play") {
      const { getGooglePlayApp, extractPackageName, searchGooglePlay } = await import("@/lib/external/googleplay");

      // Find the appId: from play_store_url, mobile_store_listings, or search
      const { data: gameRow } = await supabase.from("games").select("play_store_url").eq("id", id).maybeSingle();
      const playUrl = (gameRow as { play_store_url?: string } | null)?.play_store_url;
      let appId: string | null = playUrl ? extractPackageName(playUrl) : null;

      if (!appId) {
        // Check mobile_store_listings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: listing } = await (supabase.from("mobile_store_listings") as any)
          .select("external_id")
          .eq("game_id", id)
          .eq("store", "google_play")
          .maybeSingle();
        appId = (listing as { external_id?: string } | null)?.external_id ?? null;
      }

      if (!appId) {
        // Last resort: search by title
        const results = await searchGooglePlay(typedGame.title, 3);
        const match = results.find(r => r.title.toLowerCase() === typedGame.title.toLowerCase()) || results[0];
        if (match) appId = match.appId;
      }

      if (!appId) return jsonOk({ success: false, message: "No Google Play match found. Add a Play Store URL first.", source: "google_play" });

      const app = await getGooglePlayApp(appId);
      if (!app) return jsonOk({ success: false, message: `Failed to fetch Google Play data for ${appId}`, source: "google_play" });

      // Build update payload — only overwrite empty/missing fields by default,
      // but always refresh store-specific data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gpUpdates: Record<string, any> = {};
      const { data: currentGame } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
      const cur = currentGame as Record<string, unknown> | null;

      // Always update these from Play Store (authoritative for mobile)
      // If forceOverwrite is true, overwrite ALL fields regardless of current values
      gpUpdates.play_store_url = app.url;
      if (app.description && (forceOverwrite || !cur?.description || (cur.description as string).length < 100)) {
        gpUpdates.description = app.description.length > 4000 ? app.description.slice(0, 4000) + "..." : app.description;
      }
      if (app.icon && (forceOverwrite || !cur?.cover_image)) gpUpdates.cover_image = app.icon;
      if (app.headerImage && (forceOverwrite || !cur?.header_image)) gpUpdates.header_image = app.headerImage;
      if (app.screenshots?.length && (forceOverwrite || !(cur?.screenshots as string[] | undefined)?.length)) {
        gpUpdates.screenshots = app.screenshots.slice(0, 10);
      }
      if ((app.video || app.previewVideo) && (forceOverwrite || !cur?.trailer_url)) {
        gpUpdates.trailer_url = app.video || app.previewVideo;
        gpUpdates.trailer_thumbnail = app.videoImage || app.headerImage || null;
      }
      if (app.developerWebsite && (forceOverwrite || !cur?.website_url)) gpUpdates.website_url = app.developerWebsite;
      if (app.developer && (forceOverwrite || !cur?.developer)) gpUpdates.developer = app.developer;
      if (app.developer && (forceOverwrite || !cur?.publisher)) gpUpdates.publisher = app.developer;
      if (app.genre && (forceOverwrite || !(cur?.genres as string[] | undefined)?.length)) gpUpdates.genres = [app.genre];
      if (app.released && (forceOverwrite || !cur?.release_date)) gpUpdates.release_date = app.released;

      // Monetization
      const monetization = app.free ? (app.offersIAP ? "Free + IAP" : "Free") : "Paid";
      if (forceOverwrite || !cur?.monetization) gpUpdates.monetization = monetization;
      gpUpdates.is_free = app.free;

      // Platforms: ensure Android is included
      const curPlatforms = (cur?.platforms as string[]) ?? [];
      if (!curPlatforms.includes("Android")) {
        gpUpdates.platforms = [...curPlatforms, "Android"];
      }

      const gpFieldsToUpdate = Object.keys(gpUpdates).filter(k => k !== "updated_at");

      if (gpFieldsToUpdate.length > 0) {
        gpUpdates.updated_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("games") as any).update(gpUpdates).eq("id", id);
        if (updateError) return jsonError(`Google Play data fetched but DB update failed: ${updateError.message}`, 500);

        // Audit log
        if (cur) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fieldChanges: Record<string, { old: any; new: any }> = {};
          for (const key of gpFieldsToUpdate) {
            const oldVal = cur[key];
            const newVal = gpUpdates[key];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              fieldChanges[key] = { old: oldVal, new: newVal };
            }
          }
          if (Object.keys(fieldChanges).length > 0) {
            await writeAuditLog({
              entity_type: "game",
              entity_id: id,
              action: "update",
              field_changes: fieldChanges,
              edited_by: user?.email ?? "unknown",
              reason: `Google Play reingest: ${app.title} (${app.appId})`,
            });
          }
        }
      }

      // Upsert mobile_store_listings
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("mobile_store_listings") as any).upsert({
          game_id: id,
          store: "google_play",
          external_id: app.appId,
          store_url: app.url,
          title: app.title,
          developer: app.developer,
          icon_url: app.icon,
          header_image_url: app.headerImage || null,
          screenshots: app.screenshots?.slice(0, 10) ?? [],
          rating_average: app.score,
          rating_count: app.ratings,
          review_count: app.reviews,
          installs: app.installs || null,
          real_installs: app.maxInstalls || null,
          genre: app.genre,
          genre_id: app.genreId || null,
          content_rating: app.contentRating || null,
          version: app.version || null,
          is_free: app.free,
          offers_iap: app.offersIAP,
          iap_range: app.inAppProductPrice || null,
          price: app.price || 0,
          currency: app.currency || "USD",
          released_at: app.released || null,
          last_updated_at: app.updated ? new Date(app.updated).toISOString() : null,
          is_verified: true,
        }, { onConflict: "store,external_id" });
      } catch { /* best-effort */ }

      return jsonOk({
        success: true,
        source: "google_play",
        message: `Refreshed from Google Play: ${app.title} (${gpFieldsToUpdate.length} fields updated)`,
        data: {
          appId: app.appId,
          title: app.title,
          score: app.score,
          ratings: app.ratings,
          installs: app.installs,
          description: app.description?.slice(0, 200) ?? "",
          fieldsUpdated: gpFieldsToUpdate,
        },
      });
    }

    // ── App Store re-ingest ──
    if (source === "app_store") {
      const { searchAppStore, lookupAppStoreById } = await import("@/lib/external/appstore");

      // Find the trackId from mobile_store_listings or search
      let trackId: number | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listing } = await (supabase.from("mobile_store_listings") as any)
        .select("external_id")
        .eq("game_id", id)
        .eq("store", "app_store")
        .maybeSingle();
      if ((listing as { external_id?: string } | null)?.external_id) {
        trackId = parseInt((listing as { external_id: string }).external_id, 10);
      }

      if (!trackId) {
        // Search by title
        const results = await searchAppStore(typedGame.title, 3);
        const match = results.find(r => r.trackName.toLowerCase() === typedGame.title.toLowerCase()) || results[0];
        if (match) trackId = match.trackId;
      }

      if (!trackId) return jsonOk({ success: false, message: "No App Store match found.", source: "app_store" });

      const app = await lookupAppStoreById(trackId);
      if (!app) return jsonOk({ success: false, message: `Failed to fetch App Store data for trackId ${trackId}`, source: "app_store" });

      // Build update payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const asUpdates: Record<string, any> = {};
      const { data: currentGame } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
      const cur = currentGame as Record<string, unknown> | null;

      if (app.description && (forceOverwrite || !cur?.description || (cur.description as string).length < 100)) {
        asUpdates.description = app.description.length > 4000 ? app.description.slice(0, 4000) + "..." : app.description;
      }
      if ((app.artworkUrl512 || app.artworkUrl100) && (forceOverwrite || !cur?.cover_image)) {
        asUpdates.cover_image = app.artworkUrl512 || app.artworkUrl100;
      }
      if (app.screenshotUrls?.length && (forceOverwrite || !(cur?.screenshots as string[] | undefined)?.length)) {
        asUpdates.screenshots = app.screenshotUrls.slice(0, 10);
      }
      if (app.artistName && (forceOverwrite || !cur?.developer)) asUpdates.developer = app.artistName;
      if ((app.sellerName || app.artistName) && (forceOverwrite || !cur?.publisher)) asUpdates.publisher = app.sellerName || app.artistName;
      if (app.genres?.length && (forceOverwrite || !(cur?.genres as string[] | undefined)?.length)) asUpdates.genres = app.genres;
      if (app.releaseDate && (forceOverwrite || !cur?.release_date)) asUpdates.release_date = app.releaseDate.split("T")[0];

      // Platforms: ensure iOS is included
      const curPlatforms = (cur?.platforms as string[]) ?? [];
      if (!curPlatforms.includes("iOS")) {
        asUpdates.platforms = [...curPlatforms, "iOS"];
      }

      const asFieldsToUpdate = Object.keys(asUpdates).filter(k => k !== "updated_at");

      if (asFieldsToUpdate.length > 0) {
        asUpdates.updated_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("games") as any).update(asUpdates).eq("id", id);
        if (updateError) return jsonError(`App Store data fetched but DB update failed: ${updateError.message}`, 500);

        // Audit log
        if (cur) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fieldChanges: Record<string, { old: any; new: any }> = {};
          for (const key of asFieldsToUpdate) {
            const oldVal = cur[key];
            const newVal = asUpdates[key];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              fieldChanges[key] = { old: oldVal, new: newVal };
            }
          }
          if (Object.keys(fieldChanges).length > 0) {
            await writeAuditLog({
              entity_type: "game",
              entity_id: id,
              action: "update",
              field_changes: fieldChanges,
              edited_by: user?.email ?? "unknown",
              reason: `App Store reingest: ${app.trackName} (${app.trackId})`,
            });
          }
        }
      }

      // Upsert mobile_store_listings
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("mobile_store_listings") as any).upsert({
          game_id: id,
          store: "app_store",
          external_id: String(app.trackId),
          store_url: app.trackViewUrl,
          title: app.trackName,
          developer: app.artistName,
          icon_url: app.artworkUrl512 || app.artworkUrl100 || null,
          screenshots: app.screenshotUrls?.slice(0, 10) ?? [],
          rating_average: app.averageUserRating,
          rating_count: app.userRatingCount || 0,
          content_rating: app.contentAdvisoryRating || null,
          version: app.version || null,
          released_at: app.releaseDate ? app.releaseDate.split("T")[0] : null,
          last_updated_at: app.currentVersionReleaseDate || null,
          price: app.price || 0,
          currency: app.currency || "USD",
          is_free: app.price === 0,
          genre: app.primaryGenreName || null,
          is_verified: true,
        }, { onConflict: "store,external_id" });
      } catch { /* best-effort */ }

      return jsonOk({
        success: true,
        source: "app_store",
        message: `Refreshed from App Store: ${app.trackName} (${asFieldsToUpdate.length} fields updated)`,
        data: {
          trackId: app.trackId,
          title: app.trackName,
          rating: app.averageUserRating,
          ratingCount: app.userRatingCount,
          description: app.description?.slice(0, 200) ?? "",
          fieldsUpdated: asFieldsToUpdate,
        },
      });
    }

    // ── Both Mobile Stores re-ingest ──
    if (source === "mobile_both") {
      const { getGooglePlayApp, extractPackageName, searchGooglePlay } = await import("@/lib/external/googleplay");
      const { searchAppStore, lookupAppStoreById } = await import("@/lib/external/appstore");

      const results: { google_play?: { success: boolean; message: string }; app_store?: { success: boolean; message: string } } = {};

      // --- Google Play ---
      try {
        const { data: gameRow } = await supabase.from("games").select("play_store_url").eq("id", id).maybeSingle();
        const playUrl = (gameRow as { play_store_url?: string } | null)?.play_store_url;
        let gpAppId: string | null = playUrl ? extractPackageName(playUrl) : null;

        if (!gpAppId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: listing } = await (supabase.from("mobile_store_listings") as any)
            .select("external_id").eq("game_id", id).eq("store", "google_play").maybeSingle();
          gpAppId = (listing as { external_id?: string } | null)?.external_id ?? null;
        }
        if (!gpAppId) {
          const gpResults = await searchGooglePlay(typedGame.title, 3);
          const match = gpResults.find(r => r.title.toLowerCase() === typedGame.title.toLowerCase()) || gpResults[0];
          if (match) gpAppId = match.appId;
        }

        if (gpAppId) {
          const gpApp = await getGooglePlayApp(gpAppId);
          if (gpApp) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gpUpdates: Record<string, any> = { play_store_url: gpApp.url, updated_at: new Date().toISOString() };
            const { data: cur } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
            const curData = cur as Record<string, unknown> | null;
            const curPlatforms = (curData?.platforms as string[]) ?? [];
            if (!curPlatforms.includes("Android")) gpUpdates.platforms = [...curPlatforms, "Android"];
            
            // If forceOverwrite, update all fields from Google Play
            if (forceOverwrite) {
              if (gpApp.description) {
                gpUpdates.description = gpApp.description.length > 4000 ? gpApp.description.slice(0, 4000) + "..." : gpApp.description;
              }
              if (gpApp.icon) gpUpdates.cover_image = gpApp.icon;
              if (gpApp.headerImage) gpUpdates.header_image = gpApp.headerImage;
              if (gpApp.screenshots?.length) gpUpdates.screenshots = gpApp.screenshots.slice(0, 10);
              if (gpApp.video || gpApp.previewVideo) {
                gpUpdates.trailer_url = gpApp.video || gpApp.previewVideo;
                gpUpdates.trailer_thumbnail = gpApp.videoImage || gpApp.headerImage || null;
              }
              if (gpApp.developerWebsite) gpUpdates.website_url = gpApp.developerWebsite;
              if (gpApp.developer) gpUpdates.developer = gpApp.developer;
              if (gpApp.developer) gpUpdates.publisher = gpApp.developer;
              if (gpApp.genre) gpUpdates.genres = [gpApp.genre];
              if (gpApp.released) gpUpdates.release_date = gpApp.released;
              gpUpdates.monetization = gpApp.free ? (gpApp.offersIAP ? "Free + IAP" : "Free") : "Paid";
              gpUpdates.is_free = gpApp.free;
            }
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("games") as any).update(gpUpdates).eq("id", id);
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from("mobile_store_listings") as any).upsert({
                game_id: id, store: "google_play", external_id: gpApp.appId, store_url: gpApp.url,
                title: gpApp.title, developer: gpApp.developer, icon_url: gpApp.icon,
                rating_average: gpApp.score, rating_count: gpApp.ratings, review_count: gpApp.reviews,
                installs: gpApp.installs || null, real_installs: gpApp.maxInstalls || null,
                genre: gpApp.genre, is_free: gpApp.free, offers_iap: gpApp.offersIAP,
                price: gpApp.price || 0, currency: gpApp.currency || "USD",
                released_at: gpApp.released || null, is_verified: true,
              }, { onConflict: "store,external_id" });
            } catch { /* best-effort */ }
            results.google_play = { success: true, message: `Refreshed: ${gpApp.title}` };
          } else {
            results.google_play = { success: false, message: `Failed to fetch data for ${gpAppId}` };
          }
        } else {
          results.google_play = { success: false, message: "No Google Play match found" };
        }
      } catch (e) {
        results.google_play = { success: false, message: (e as Error).message };
      }

      // --- App Store ---
      try {
        let trackId: number | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: asListing } = await (supabase.from("mobile_store_listings") as any)
          .select("external_id").eq("game_id", id).eq("store", "app_store").maybeSingle();
        if ((asListing as { external_id?: string } | null)?.external_id) {
          trackId = parseInt((asListing as { external_id: string }).external_id, 10);
        }
        if (!trackId) {
          const asResults = await searchAppStore(typedGame.title, 3);
          const match = asResults.find(r => r.trackName.toLowerCase() === typedGame.title.toLowerCase()) || asResults[0];
          if (match) trackId = match.trackId;
        }

        if (trackId) {
          const asApp = await lookupAppStoreById(trackId);
          if (asApp) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const asUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
            const { data: cur } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
            const curData = cur as Record<string, unknown> | null;
            const curPlatforms = (curData?.platforms as string[]) ?? [];
            if (!curPlatforms.includes("iOS")) asUpdates.platforms = [...curPlatforms, "iOS"];
            
            // If forceOverwrite, update all fields from App Store
            if (forceOverwrite) {
              if (asApp.description) {
                asUpdates.description = asApp.description.length > 4000 ? asApp.description.slice(0, 4000) + "..." : asApp.description;
              }
              if (asApp.artworkUrl512 || asApp.artworkUrl100) {
                asUpdates.cover_image = asApp.artworkUrl512 || asApp.artworkUrl100;
              }
              if (asApp.screenshotUrls?.length) asUpdates.screenshots = asApp.screenshotUrls.slice(0, 10);
              if (asApp.artistName) asUpdates.developer = asApp.artistName;
              if (asApp.sellerName || asApp.artistName) asUpdates.publisher = asApp.sellerName || asApp.artistName;
              if (asApp.genres?.length) asUpdates.genres = asApp.genres;
              if (asApp.releaseDate) asUpdates.release_date = asApp.releaseDate.split("T")[0];
            }
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("games") as any).update(asUpdates).eq("id", id);
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from("mobile_store_listings") as any).upsert({
                game_id: id, store: "app_store", external_id: String(asApp.trackId),
                store_url: asApp.trackViewUrl, title: asApp.trackName, developer: asApp.artistName,
                icon_url: asApp.artworkUrl512 || asApp.artworkUrl100 || null,
                screenshots: asApp.screenshotUrls?.slice(0, 10) ?? [],
                rating_average: asApp.averageUserRating, rating_count: asApp.userRatingCount || 0,
                price: asApp.price || 0, currency: asApp.currency || "USD",
                is_free: asApp.price === 0, genre: asApp.primaryGenreName || null,
                released_at: asApp.releaseDate ? asApp.releaseDate.split("T")[0] : null,
                is_verified: true,
              }, { onConflict: "store,external_id" });
            } catch { /* best-effort */ }
            results.app_store = { success: true, message: `Refreshed: ${asApp.trackName}` };
          } else {
            results.app_store = { success: false, message: `Failed to fetch data for trackId ${trackId}` };
          }
        } else {
          results.app_store = { success: false, message: "No App Store match found" };
        }
      } catch (e) {
        results.app_store = { success: false, message: (e as Error).message };
      }

      const gpOk = results.google_play?.success ?? false;
      const asOk = results.app_store?.success ?? false;

      return jsonOk({
        success: gpOk || asOk,
        source: "mobile_both",
        message: `Google Play: ${results.google_play?.message ?? "skipped"} | App Store: ${results.app_store?.message ?? "skipped"}`,
        data: results,
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
