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

    let { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("slug", slug)
      .maybeSingle() as { data: GameRow | null; error: unknown };

    if (error) throw error;

    // If not found, try fuzzy slug match first (handles minor slug differences)
    if (!data) {
      const { data: fuzzy } = await supabase
        .from("games")
        .select("*")
        .ilike("slug", slug)
        .maybeSingle() as { data: GameRow | null };
      if (fuzzy) data = fuzzy;
    }

    // If still not found, try on-demand ingestion.
    // Pass the original slug as a hint so ingest can verify the RAWG result.
    if (!data) {
      try {
        const { ingestGame } = await import("@/lib/services/ingest");
        const queryTitle = slug.replace(/-/g, " ");
        const result = await ingestGame({ query: queryTitle, expectedSlug: slug });
        if (result.success && result.gameId) {
          const refetch = await supabase
            .from("games")
            .select("*")
            .eq("id", result.gameId)
            .maybeSingle() as { data: GameRow | null };
          data = refetch.data;
        }
      } catch (ingestErr) {
        console.warn(`[API] /games/${slug} on-demand ingest failed:`, ingestErr);
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

    return jsonOk(mapGameRow(data));
  } catch (err) {
    console.error(`[API] /games/${slug} error:`, err);
    return jsonNotFound("Game");
  }
}
