/**
 * GET /api/games/[slug]
 *
 * Returns a single game by slug, with related games.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

function provisionalRecordForSlug(slug: string) {
  const queryTitle = slug.replace(/-/g, " ");
  return {
    slug,
    title: queryTitle.replace(/\b\w/g, (c) => c.toUpperCase()),
    subtitle: null,
    cover_image: "",
    header_image: "",
    screenshots: [] as string[],
    platforms: [] as string[],
    genres: [] as string[],
    tags: [] as string[],
    developer: "",
    publisher: "",
    release_date: null,
    description:
      "This game page is awaiting data enrichment. Information will be updated automatically when source data becomes available.",
    score: 0,
    verdict_label: "COMING SOON",
    verdict_summary: "",
    pros: [] as string[],
    cons: [] as string[],
    monetization: "",
    performance_notes: "",
    monetization_notes: "",
    review_count: 0,
    featured: false,
    trending: false,
    score_source: "provisional",
    enrichment_sources: [] as string[],
    price_currency: "USD",
    is_free: false,
  };
}

/**
 * Slug redirect map — fixes known RAWG typos and duplicates.
 * When a user visits /game/bad-slug, we redirect to the correct slug.
 */
const SLUG_REDIRECTS: Record<string, string> = {
  "grand-theft-aito-vi": "grand-theft-auto-vi",  // RAWG typo for GTA VI
};

/**
 * Blocked slugs — never auto-provision these.
 * Must match the blocklist in ingest.ts.
 */
const BLOCKED_SLUGS = new Set(Object.keys(SLUG_REDIRECTS));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Redirect known bad slugs to their correct version
  const redirect = SLUG_REDIRECTS[slug];
  if (redirect) {
    const url = new URL(request.url);
    url.pathname = `/api/games/${redirect}`;
    const res = await fetch(url.toString(), { headers: request.headers });
    const json = await res.json();
    return new Response(JSON.stringify(json), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonNotFound("Game");
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    let { data, error } = (await supabase
      .from("games")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()) as { data: GameRow | null; error: unknown };

    if (error) throw error;

    // REMOVED: fuzzy ilike slug matching — this caused wrong-game resolution
    // (e.g. "grand-theft-auto-vi" matching "grand-theft-auto-v")

    // IGDB first — GX/calendar slugs often exist on IGDB before RAWG; also avoids wrong RAWG matches.
    if (!data) {
      try {
        const { tryInsertGameFromIgdbSlug } = await import("@/lib/services/igdbBootstrap");
        const bootstrapped = await tryInsertGameFromIgdbSlug(slug, getServerSupabase());
        if (bootstrapped) data = bootstrapped;
      } catch (igdbErr) {
        console.warn(`[API] /games/${slug} IGDB bootstrap failed:`, igdbErr);
      }
    }

    // RAWG multi-source ingest (must return this exact URL slug — never swap in another game).
    if (!data) {
      try {
        const { ingestGame } = await import("@/lib/services/ingest");
        const queryTitle = slug.replace(/-/g, " ");
        const result = await ingestGame({ query: queryTitle, expectedSlug: slug }) as
          import("@/lib/services/ingest").IngestResult & { lowConfidence?: boolean };

        if (result.success && result.gameId) {
          const refetch = await supabase
            .from("games")
            .select("*")
            .eq("id", result.gameId)
            .maybeSingle() as { data: GameRow | null };
          const row = refetch.data;
          if (row?.slug === slug) {
            data = row;
          } else if (row) {
            console.warn(
              `[API] /games/${slug} ingest resolved to different slug "${row.slug}" — ignoring to avoid wrong page`
            );
          }
        } else if ((result as { lowConfidence?: boolean }).lowConfidence) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: inserted, error: insertErr } = await (supabase.from("games") as any)
            .insert(provisionalRecordForSlug(slug))
            .select("*")
            .single() as { data: GameRow | null; error: { message: string } | null };

          if (!insertErr && inserted) {
            data = inserted;
          }
        }
      } catch (ingestErr) {
        console.warn(`[API] /games/${slug} on-demand ingest failed:`, ingestErr);
      }
    }

    // Last resort: stub page for valid slugs (calendar links, Twitch/IGDB missing on host, etc.)
    if (!data && /^[a-z0-9-]{1,100}$/i.test(slug)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error: insertErr } = await (supabase.from("games") as any)
          .insert(provisionalRecordForSlug(slug))
          .select("*")
          .single() as { data: GameRow | null; error: { message: string } | null };

        if (!insertErr && inserted) {
          data = inserted;
        }
      } catch (stubErr) {
        console.warn(`[API] /games/${slug} provisional stub failed:`, stubErr);
      }
    }

    if (!data) {
      return jsonNotFound("Game");
    }

    // Mark stale games for re-enrichment by the cron job (/api/cron/re-enrich).
    // Previously this fired a background promise here, which was unreliable and
    // could cause request timeouts. Now the cron picks up stale rows in batch.
    if (data.last_enriched_at) {
      const ageMs = Date.now() - new Date(data.last_enriched_at).getTime();
      const STALE_THRESHOLD = 24 * 60 * 60 * 1000;
      if (ageMs > STALE_THRESHOLD && !data.is_refreshing) {
        // Reset refresh_started_at so the cron picks this game up sooner
        try {
          await supabase
            .from("games")
            .update({ refresh_started_at: null })
            .eq("id", data.id)
            .eq("is_refreshing", false);
        } catch {
          /* column may not exist before migration */
        }
      }
    }

    const game = mapGameRow(data);

    // Enrich with verified mobile store URLs from mobile_store_listings
    try {
      const { data: mobileListings } = await supabase
        .from("mobile_store_listings")
        .select("store, store_url")
        .eq("game_id", data.id)
        .eq("is_verified", true);

      if (mobileListings) {
        for (const listing of mobileListings) {
          if (listing.store === "google_play" && listing.store_url && !game.playStoreUrl) {
            game.playStoreUrl = listing.store_url;
          }
          if (listing.store === "app_store" && listing.store_url) {
            game.appStoreUrl = listing.store_url;
          }
        }
      }
    } catch {
      /* mobile_store_listings may not exist yet */
    }

    return jsonOk(game, 200, { cache: true });
  } catch (err) {
    console.error(`[API] /games/${slug} error:`, err);
    return jsonNotFound("Game");
  }
}
