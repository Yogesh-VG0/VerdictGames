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
      gpUpdates.play_store_url = app.url;
      if (app.description && (!cur?.description || (cur.description as string).length < 100)) {
        gpUpdates.description = app.description.length > 4000 ? app.description.slice(0, 4000) + "..." : app.description;
      }
      if (app.icon && !cur?.cover_image) gpUpdates.cover_image = app.icon;
      if (app.headerImage && !cur?.header_image) gpUpdates.header_image = app.headerImage;
      if (app.screenshots?.length && !(cur?.screenshots as string[] | undefined)?.length) {
        gpUpdates.screenshots = app.screenshots.slice(0, 10);
      }
      if ((app.video || app.previewVideo) && !cur?.trailer_url) {
        gpUpdates.trailer_url = app.video || app.previewVideo;
        gpUpdates.trailer_thumbnail = app.videoImage || app.headerImage || null;
      }
      if (app.developerWebsite && !cur?.website_url) gpUpdates.website_url = app.developerWebsite;
      if (app.developer && !cur?.developer) gpUpdates.developer = app.developer;
      if (app.developer && !cur?.publisher) gpUpdates.publisher = app.developer;
      if (app.genre && !(cur?.genres as string[] | undefined)?.length) gpUpdates.genres = [app.genre];
      if (app.released && !cur?.release_date) gpUpdates.release_date = app.released;

      // Monetization
      const monetization = app.free ? (app.offersIAP ? "Free + IAP" : "Free") : "Paid";
      if (!cur?.monetization) gpUpdates.monetization = monetization;
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

      if (app.description && (!cur?.description || (cur.description as string).length < 100)) {
        asUpdates.description = app.description.length > 4000 ? app.description.slice(0, 4000) + "..." : app.description;
      }
      if ((app.artworkUrl512 || app.artworkUrl100) && !cur?.cover_image) {
        asUpdates.cover_image = app.artworkUrl512 || app.artworkUrl100;
      }
      if (app.screenshotUrls?.length && !(cur?.screenshots as string[] | undefined)?.length) {
        asUpdates.screenshots = app.screenshotUrls.slice(0, 10);
      }
      if (app.artistName && !cur?.developer) asUpdates.developer = app.artistName;
      if ((app.sellerName || app.artistName) && !cur?.publisher) asUpdates.publisher = app.sellerName || app.artistName;
      if (app.genres?.length && !(cur?.genres as string[] | undefined)?.length) asUpdates.genres = app.genres;
      if (app.releaseDate && !cur?.release_date) asUpdates.release_date = app.releaseDate.split("T")[0];

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
