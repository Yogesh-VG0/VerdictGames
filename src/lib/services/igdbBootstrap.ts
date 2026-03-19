/**
 * Bootstrap a `games` row from IGDB when RAWG has no listing but IGDB does
 * (e.g. very new titles linked from the release calendar).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GameRow } from "../supabase/types";
import {
  getIgdbGameBySlug,
  extractIgdbEnrichment,
  igdbImageUrl,
  isIgdbConfigured,
} from "../external/igdb";
import { scoreToVerdict } from "../utils/score";

export async function tryInsertGameFromIgdbSlug(
  urlSlug: string,
  supabase: SupabaseClient<Database>
): Promise<GameRow | null> {
  if (!isIgdbConfigured()) return null;

  const { data: existing } = await supabase
    .from("games")
    .select("*")
    .eq("slug", urlSlug)
    .maybeSingle();
  if (existing) return existing as GameRow;

  const igdb = await getIgdbGameBySlug(urlSlug);
  if (!igdb) return null;

  const enrich = extractIgdbEnrichment(igdb);
  const cover = igdb.cover?.image_id ? igdbImageUrl(igdb.cover.image_id) : "";
  const screenshots = (igdb.screenshots ?? [])
    .slice(0, 8)
    .map((s) => igdbImageUrl(s.image_id, "screenshot_med"));

  const ratingScore =
    enrich.igdbRating ??
    (igdb.total_rating != null ? Math.round(igdb.total_rating) : null) ??
    (igdb.rating != null ? Math.round(igdb.rating) : 0);
  const verdictLabel =
    ratingScore > 0 ? scoreToVerdict(ratingScore) : ("COMING SOON" as const);

  const developer =
    igdb.involved_companies?.find((c) => c.developer)?.company?.name ?? "";
  const publisher =
    igdb.involved_companies?.find((c) => c.publisher)?.company?.name ?? developer;

  const platforms = (igdb.platforms ?? []).map((p) => p.name).filter(Boolean);
  const genres = (igdb.genres ?? []).map((g) => g.name);

  const releaseDate =
    igdb.first_release_date != null
      ? new Date(igdb.first_release_date * 1000).toISOString().slice(0, 10)
      : null;

  const today = new Date().toISOString().slice(0, 10);
  const description =
    (enrich.igdbSummary || igdb.summary || "").slice(0, 8000) ||
    `Metadata from IGDB for “${igdb.name}”.`;

  const record = {
    slug: urlSlug,
    title: igdb.name,
    subtitle: null as string | null,
    cover_image: cover,
    header_image: cover,
    screenshots,
    platforms,
    genres,
    tags: genres.slice(0, 8),
    developer,
    publisher,
    release_date: releaseDate,
    description,
    score: ratingScore,
    verdict_label: verdictLabel,
    verdict_summary: `${igdb.name} — sourced from IGDB.`,
    pros: [] as string[],
    cons: [] as string[],
    monetization: "Paid",
    performance_notes: "",
    monetization_notes: "",
    steam_url: null as string | null,
    play_store_url: null as string | null,
    review_count: igdb.aggregated_rating_count ?? igdb.rating_count ?? 0,
    user_score: igdb.rating != null ? Math.round(igdb.rating) : null,
    featured: false,
    trending: false,
    rawg_id: null as number | null,
    steam_app_id: null as number | null,
    price_currency: "USD",
    is_free: false,
    trailer_url: enrich.trailerUrl,
    trailer_thumbnail: enrich.trailerThumbnail,
    igdb_id: igdb.id,
    igdb_url: enrich.igdbUrl,
    igdb_rating: enrich.igdbRating,
    igdb_summary: enrich.igdbSummary,
    wikipedia_url: enrich.wikipediaUrl,
    wikipedia_excerpt: null as string | null,
    metacritic_url: null as string | null,
    website_url: enrich.websiteUrl,
    reddit_url: enrich.redditUrl,
    score_source: "igdb",
    last_enriched_at: new Date().toISOString(),
    enrichment_sources: ["igdb"],
    is_provisional: false,
    release_status:
      releaseDate && releaseDate > today ? "upcoming" : ("released" as string | null),
    momentum: 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase.from("games") as any)
    .insert(record)
    .select("*")
    .single() as { data: GameRow | null; error: { code?: string; message?: string } | null };

  if (!error && inserted) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("game_sources") as any).upsert(
      {
        game_id: inserted.id,
        source_name: "igdb",
        source_game_id: String(igdb.id),
        source_url: enrich.igdbUrl ?? `https://www.igdb.com/games/${igdb.slug}`,
        raw_data: igdb as unknown as Record<string, unknown>,
      },
      { onConflict: "source_name,source_game_id" }
    );
    return inserted;
  }

  if (error?.code === "23505") {
    const { data: row } = await supabase
      .from("games")
      .select("*")
      .eq("slug", urlSlug)
      .maybeSingle();
    return (row as GameRow) ?? null;
  }

  console.warn("[igdbBootstrap] insert failed:", error?.message ?? error);
  return null;
}
