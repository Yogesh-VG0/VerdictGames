/**
 * GET /api/games/[slug]
 *
 * Returns a single game by slug, with related games.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonNotFound } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

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

    // If not found, try on-demand ingestion.
    // Pass the original slug as a hint so ingest can verify the RAWG result.
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
          data = refetch.data;
        } else if ((result as { lowConfidence?: boolean }).lowConfidence) {
          // Low confidence match — create a provisional placeholder page
          // instead of returning 404 or mapping to a wrong game
          const provisionalRecord = {
            slug,
            title: queryTitle.replace(/\b\w/g, c => c.toUpperCase()),
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
            description: "This game page is awaiting data enrichment. Information will be updated automatically when source data becomes available.",
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
            is_provisional: true,
            release_status: "upcoming",
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: inserted, error: insertErr } = await (supabase
            .from("games") as any)
            .insert(provisionalRecord)
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

    // RAWG often lags new releases; IGDB may already list the game (same slug as calendar links).
    if (!data) {
      try {
        const { tryInsertGameFromIgdbSlug } = await import("@/lib/services/igdbBootstrap");
        const bootstrapped = await tryInsertGameFromIgdbSlug(slug, getServerSupabase());
        if (bootstrapped) data = bootstrapped;
      } catch (igdbErr) {
        console.warn(`[API] /games/${slug} IGDB bootstrap failed:`, igdbErr);
      }
    }

    if (!data) {
      return jsonNotFound("Game");
    }

    // On-demand re-enrichment: if data is stale (>24h), try to acquire lock and refresh
    if (data.last_enriched_at) {
      const ageMs = Date.now() - new Date(data.last_enriched_at).getTime();
      const STALE_THRESHOLD = 24 * 60 * 60 * 1000;
      if (ageMs > STALE_THRESHOLD) {
        const gameId = data.id;
        const gameTitle = data.title;
        let acquired = false;
        try {
          const cutoff = new Date(Date.now() - STALE_THRESHOLD).toISOString();
          const lockCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const now = new Date().toISOString();
          const { data: locked } = await supabase
            .from("games")
            .update({ is_refreshing: true, refresh_started_at: now })
            .eq("id", gameId)
            .or(`is_refreshing.eq.false,refresh_started_at.is.null,refresh_started_at.lt.${lockCutoff}`)
            .lt("last_enriched_at", cutoff)
            .select("id")
            .maybeSingle();
          acquired = !!locked;
        } catch {
          acquired = true;
        }
        if (acquired) {
          import("@/lib/services/ingest").then(async ({ ingestGame }) => {
            try {
              await ingestGame({ query: gameTitle, forceRefresh: true });
            } catch (e) {
              console.warn(`[API] /games/${slug} background re-enrichment failed:`, e);
            } finally {
              try {
                await getServerSupabase().from("games").update({ is_refreshing: false, refresh_started_at: null }).eq("id", gameId);
              } catch {
                /* column may not exist before migration */
              }
            }
          });
        }
      }
    }

    return jsonOk(mapGameRow(data), 200, { cache: true });
  } catch (err) {
    console.error(`[API] /games/${slug} error:`, err);
    return jsonNotFound("Game");
  }
}
