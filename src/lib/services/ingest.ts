/**
 * VERDICT.GAMES — Multi-Source Game Ingestion Service
 *
 * On-demand pipeline:
 *   1. Search RAWG by title (primary source)
 *   2. Fetch full metadata + screenshots + store links from RAWG
 *   3. Check for duplicates via slug or rawg_id
 *   4. Enrich with multiple sources in parallel:
 *      - Steam reviews + player counts + price
 *      - CheapShark deals / pricing
 *      - IGDB metadata (ratings, trailers, links)
 *      - Wikipedia summaries
 *   5. Merge all data into unified game record
 *   6. Insert/update games table
 *   7. Create source mappings
 *
 * Server-only. Called from POST /api/ingest/game.
 */

import { getServerSupabase } from "../supabase/server";
import {
  searchRawg,
  getRawgGame,
  getRawgScreenshots,
  getRawgStoreLinks,
  extractSteamAppId,
  extractPlayStoreUrl,
  mapRawgPlatforms,
  type RawgGameDetail,
} from "../external/rawg";
import {
  getSteamAppDetails,
  getSteamReviewSummary,
  getSteamPlayerCount,
  steamScoreToPercent,
  steamStoreUrl,
  extractSteamPrice,
} from "../external/steam";
import { findCheapSharkDeal } from "../external/cheapshark";
import { findIgdbMatch, extractIgdbEnrichment, isIgdbConfigured } from "../external/igdb";
import { findGameWikiSummary } from "../external/wikipedia";
import { slugify } from "../utils/slugify";
import { scoreToVerdict } from "../utils/score";

/* ───────── Types ───────── */

export interface IngestResult {
  success: boolean;
  gameId: string | null;
  slug: string | null;
  message: string;
  alreadyExisted: boolean;
}

export interface IngestOptions {
  query: string;
  forceRefresh?: boolean; // re-fetch even if game already exists
}

/* ───────── Main Ingestion Function ───────── */

export async function ingestGame(options: IngestOptions): Promise<IngestResult> {
  const { query, forceRefresh = false } = options;
  const supabase = getServerSupabase();

  // ── Step 1: Search RAWG ──
  const searchResults = await searchRawg(query);
  if (!searchResults.results.length) {
    return {
      success: false,
      gameId: null,
      slug: null,
      message: `No results found on RAWG for "${query}".`,
      alreadyExisted: false,
    };
  }

  // Pick the best match: prefer results with release dates, ratings, and higher rating counts
  const bestMatch = searchResults.results.reduce((best, cur) => {
    // Score each result: has release date (+3), has rating (+2), higher ratings_count (+1)
    const scoreOf = (r: typeof best) =>
      (r.released ? 3 : 0) +
      (r.rating ? 2 : 0) +
      Math.min((r.ratings_count ?? 0) / 1000, 5);
    return scoreOf(cur) > scoreOf(best) ? cur : best;
  }, searchResults.results[0]);
  const slug = slugify(bestMatch.name);

  // ── Step 2: Check if game already exists ──
  const { data: existing } = await supabase
    .from("games")
    .select("id, slug")
    .or(`slug.eq.${slug},rawg_id.eq.${bestMatch.id}`)
    .maybeSingle() as { data: { id: string; slug: string } | null };

  if (existing && !forceRefresh) {
    return {
      success: true,
      gameId: existing.id,
      slug: existing.slug,
      message: `Game "${bestMatch.name}" already exists in database.`,
      alreadyExisted: true,
    };
  }

  // ── Step 3: Fetch full details + screenshots + store links ──
  const [fullGame, screenshots, storeLinks] = await Promise.all([
    getRawgGame(bestMatch.id),
    getRawgScreenshots(bestMatch.id),
    getRawgStoreLinks(bestMatch.id),
  ]);

  // ── Step 4: Extract Steam App ID ──
  const steamAppId = extractSteamAppId(fullGame.stores, storeLinks);
  const playStoreUrl = extractPlayStoreUrl(fullGame.stores, storeLinks);

  // ── Step 5: Multi-source enrichment (parallel) ──
  // Fire all enrichment calls at once — each is independent
  const enrichmentSources: string[] = ["rawg"];

  const [
    steamReviewData,
    steamAppData,
    steamPlayerData,
    cheapSharkData,
    igdbData,
    wikiData,
  ] = await Promise.all([
    // Steam reviews (if Steam game)
    steamAppId ? getSteamReviewSummary(steamAppId) : Promise.resolve(null),
    // Steam app details for price
    steamAppId ? getSteamAppDetails(steamAppId) : Promise.resolve(null),
    // Steam player count
    steamAppId ? getSteamPlayerCount(steamAppId) : Promise.resolve(null),
    // CheapShark deals
    findCheapSharkDeal(fullGame.name, steamAppId).catch(() => null),
    // IGDB metadata (only if configured)
    isIgdbConfigured()
      ? findIgdbMatch(
          fullGame.name,
          fullGame.released ? new Date(fullGame.released).getFullYear() : undefined
        ).catch(() => null)
      : Promise.resolve(null),
    // Wikipedia summary
    findGameWikiSummary(fullGame.name).catch(() => null),
  ]);

  // ── Step 6: Process Steam data ──
  let steamScore: number | null = null;
  let steamReviewCount = 0;
  if (steamReviewData) {
    steamScore = steamScoreToPercent(
      steamReviewData.total_positive,
      steamReviewData.total_reviews
    );
    steamReviewCount = steamReviewData.total_reviews;
    enrichmentSources.push("steam");
  }

  const steamPrice = steamAppData ? extractSteamPrice(steamAppData) : null;
  const currentPlayers = steamPlayerData ?? null;

  // ── Step 7: Process CheapShark data ──
  let cheapsharkId: string | null = null;
  let priceCurrent: number | null = steamPrice?.priceCurrent ?? null;
  let priceCurrency: string = steamPrice?.priceCurrency ?? "USD";
  let priceLowest: number | null = null;
  let priceDealUrl: string | null = null;
  let isFree: boolean = steamPrice?.isFree ?? false;

  if (cheapSharkData) {
    cheapsharkId = cheapSharkData.cheapsharkId;
    // CheapShark may have better deal prices
    if (cheapSharkData.priceCurrent !== null) {
      // Use lower of Steam price and CheapShark price
      if (priceCurrent === null || cheapSharkData.priceCurrent < priceCurrent) {
        priceCurrent = cheapSharkData.priceCurrent;
      }
    }
    priceLowest = cheapSharkData.priceLowest;
    priceDealUrl = cheapSharkData.priceDealUrl;
    if (cheapSharkData.isFree) isFree = true;
    enrichmentSources.push("cheapshark");
  }

  // ── Step 8: Process IGDB data ──
  let igdbEnrichment: ReturnType<typeof extractIgdbEnrichment> | null = null;
  if (igdbData) {
    igdbEnrichment = extractIgdbEnrichment(igdbData);
    enrichmentSources.push("igdb");
  }

  // ── Step 9: Process Wikipedia data ──
  let wikipediaUrl: string | null = igdbEnrichment?.wikipediaUrl ?? null;
  let wikipediaExcerpt: string | null = null;
  if (wikiData) {
    wikipediaExcerpt = wikiData.excerpt;
    wikipediaUrl = wikiData.url;
    enrichmentSources.push("wikipedia");
  }

  // ── Step 10: Compute score ──
  // Priority: Steam review % → IGDB aggregated → RAWG metacritic → RAWG rating * 20
  // Also track which source the main score came from
  let scoreSource = "blended";
  const score = (() => {
    if (steamScore !== null) { scoreSource = "steam"; return steamScore; }
    if (igdbEnrichment?.igdbRating) { scoreSource = "igdb"; return igdbEnrichment.igdbRating; }
    if (fullGame.metacritic) { scoreSource = "metacritic"; return fullGame.metacritic; }
    scoreSource = "rawg";
    return Math.round((fullGame.rating || 3) * 20);
  })();

  // Store per-source values separately
  const steamRatingLabel = steamReviewData?.review_score_desc ?? null;
  const rawgMetacritic = fullGame.metacritic ?? null;
  const rawgRating = fullGame.rating ?? null;

  const verdictLabel = scoreToVerdict(score);

  // ── Step 11: Build game record ──
  const screenshotUrls = screenshots.map((s) => s.image);
  const platforms = mapRawgPlatforms(fullGame.platforms);
  const genres = (fullGame.genres ?? []).map((g) => g.name);
  const tags = (fullGame.tags ?? []).slice(0, 12).map((t) => t.name);
  const developer = fullGame.developers?.[0]?.name ?? "";
  const publisher = fullGame.publishers?.[0]?.name ?? "";

  const gameRecord = {
    slug,
    title: fullGame.name,
    subtitle: null,
    cover_image: fullGame.background_image ?? "",
    header_image: fullGame.background_image_additional ?? fullGame.background_image ?? "",
    screenshots: screenshotUrls,
    platforms,
    genres,
    tags,
    developer,
    publisher,
    release_date: fullGame.released ?? null,
    description: buildDescription(fullGame, igdbData, wikiData),
    score,
    verdict_label: verdictLabel,
    verdict_summary: generateVerdictSummary(fullGame.name, score, genres),
    pros: generateSmartPros(fullGame, steamReviewData, igdbData, currentPlayers),
    cons: generateSmartCons(fullGame, steamReviewData, igdbData),
    monetization: isFree ? "Free" : detectMonetization(fullGame),
    performance_notes: "",
    monetization_notes: "",
    steam_url: steamAppId ? steamStoreUrl(steamAppId) : null,
    play_store_url: playStoreUrl,
    review_count: steamReviewCount || fullGame.ratings_count || 0,
    user_score: steamScore,
    featured: false,
    trending: false,
    rawg_id: fullGame.id,
    steam_app_id: steamAppId,

    // Multi-source fields
    price_current: priceCurrent,
    price_currency: priceCurrency,
    price_lowest: priceLowest,
    price_deal_url: priceDealUrl,
    is_free: isFree,
    current_players: currentPlayers,
    peak_players_24h: null as number | null,    // would need historical tracking
    trailer_url: igdbEnrichment?.trailerUrl ?? null,
    trailer_thumbnail: igdbEnrichment?.trailerThumbnail ?? null,
    igdb_id: igdbEnrichment?.igdbId ?? null,
    igdb_url: igdbEnrichment?.igdbUrl ?? null,
    igdb_rating: igdbEnrichment?.igdbRating ?? null,
    igdb_summary: igdbEnrichment?.igdbSummary ?? null,
    wikipedia_url: wikipediaUrl,
    wikipedia_excerpt: wikipediaExcerpt,
    metacritic_url: fullGame.metacritic_url ?? null,
    website_url: igdbEnrichment?.websiteUrl ?? fullGame.website ?? null,
    reddit_url: igdbEnrichment?.redditUrl ?? fullGame.reddit_url ?? null,
    cheapshark_id: cheapsharkId,
    steam_rating_label: steamRatingLabel,
    rawg_metacritic: rawgMetacritic,
    rawg_rating: rawgRating,
    score_source: scoreSource,
    last_enriched_at: new Date().toISOString(),
    enrichment_sources: enrichmentSources,
  };

  // ── Step 12: Upsert game ──
  let gameId: string;

  if (existing && forceRefresh) {
    // Update existing record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from("games") as any)
      .update(gameRecord)
      .eq("id", existing.id);

    if (updateError) {
      return {
        success: false,
        gameId: null,
        slug: null,
        message: `Failed to update game: ${updateError.message}`,
        alreadyExisted: true,
      };
    }
    gameId = existing.id;
  } else {
    // Insert new record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insertError } = await (supabase
      .from("games") as any)
      .insert(gameRecord)
      .select("id")
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (insertError || !inserted) {
      return {
        success: false,
        gameId: null,
        slug: null,
        message: `Failed to insert game: ${insertError?.message ?? "Unknown error"}`,
        alreadyExisted: false,
      };
    }
    gameId = inserted.id;
  }

  // ── Step 13: Create source mappings ──
  // RAWG source
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("game_sources") as any).upsert(
    {
      game_id: gameId,
      source_name: "rawg",
      source_game_id: String(fullGame.id),
      source_url: `https://rawg.io/games/${fullGame.slug}`,
      raw_data: fullGame as unknown as Record<string, unknown>,
    },
    { onConflict: "source_name,source_game_id" }
  );

  // Steam source
  if (steamAppId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("game_sources") as any).upsert(
      {
        game_id: gameId,
        source_name: "steam",
        source_game_id: String(steamAppId),
        source_url: steamStoreUrl(steamAppId),
      },
      { onConflict: "source_name,source_game_id" }
    );
  }

  // IGDB source
  if (igdbEnrichment?.igdbId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("game_sources") as any).upsert(
      {
        game_id: gameId,
        source_name: "igdb",
        source_game_id: String(igdbEnrichment.igdbId),
        source_url: igdbEnrichment.igdbUrl,
      },
      { onConflict: "source_name,source_game_id" }
    );
  }

  // CheapShark source
  if (cheapsharkId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("game_sources") as any).upsert(
      {
        game_id: gameId,
        source_name: "cheapshark",
        source_game_id: cheapsharkId,
        source_url: priceDealUrl,
      },
      { onConflict: "source_name,source_game_id" }
    );
  }

  return {
    success: true,
    gameId,
    slug,
    message: existing
      ? `Game "${fullGame.name}" refreshed successfully.`
      : `Game "${fullGame.name}" ingested successfully.`,
    alreadyExisted: !!existing,
  };
}

/* ───────── Batch Ingestion ───────── */

export async function ingestMultipleGames(
  queries: string[]
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const query of queries) {
    try {
      const result = await ingestGame({ query });
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        gameId: null,
        slug: null,
        message: `Error ingesting "${query}": ${error instanceof Error ? error.message : "Unknown error"}`,
        alreadyExisted: false,
      });
    }
    // Rate limit: 1 second between requests to be nice to RAWG
    await new Promise((r) => setTimeout(r, 1000));
  }
  return results;
}

/* ───────── Helpers ───────── */

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function detectMonetization(game: RawgGameDetail): string {
  // If we had Steam price data we could be more precise.
  // For now, use a heuristic based on tags/genres.
  const freeIndicators = ["free-to-play", "free to play", "f2p"];
  const allTags = [
    ...(game.tags ?? []).map((t) => t.name.toLowerCase()),
    ...(game.genres ?? []).map((g) => g.name.toLowerCase()),
  ];

  if (allTags.some((t) => freeIndicators.includes(t))) {
    return "Free";
  }
  return "Paid";
}

function generateVerdictSummary(
  title: string,
  score: number,
  genres: string[]
): string {
  const genreStr = genres.slice(0, 2).join("/") || "game";
  if (score >= 90) return `${title} is an exceptional ${genreStr} experience that sets a new standard.`;
  if (score >= 75) return `${title} is a solid ${genreStr} worth your time and attention.`;
  if (score >= 50) return `${title} has moments of brilliance but inconsistent execution holds it back.`;
  return `${title} struggles to deliver on its ${genreStr} promises.`;
}

/**
 * Build the best description from multiple sources.
 * Priority: Wikipedia (clean, concise) → IGDB (summary/storyline) → RAWG (truncated)
 */
function buildDescription(
  rawg: RawgGameDetail,
  igdb: import("../external/igdb").IgdbGame | null,
  wiki: { excerpt: string; url: string } | null
): string {
  // Wikipedia is the cleanest, most readable source — use as-is (already sentence-trimmed)
  if (wiki?.excerpt && wiki.excerpt.length > 80) {
    return wiki.excerpt;
  }
  // IGDB summary is usually a concise editorial description
  if (igdb?.summary && igdb.summary.length > 80) {
    if (igdb.summary.length > 1200) {
      const cut = igdb.summary.substring(0, 1200);
      const lp = cut.lastIndexOf(".");
      return lp > 400 ? cut.substring(0, lp + 1) : cut.trimEnd() + "...";
    }
    return igdb.summary;
  }
  // IGDB storyline as a fallback
  if (igdb?.storyline && igdb.storyline.length > 80) {
    if (igdb.storyline.length > 1200) {
      const cut = igdb.storyline.substring(0, 1200);
      const lp = cut.lastIndexOf(".");
      return lp > 400 ? cut.substring(0, lp + 1) : cut.trimEnd() + "...";
    }
    return igdb.storyline;
  }
  // Last resort: RAWG description, cleaned and trimmed at sentence boundary
  const rawDesc = rawg.description_raw || stripHtml(rawg.description) || "";
  if (rawDesc.length > 1200) {
    const cut = rawDesc.substring(0, 1200);
    const lastPeriod = cut.lastIndexOf(".");
    if (lastPeriod > 400) return cut.substring(0, lastPeriod + 1);
    return cut.trimEnd() + "...";
  }
  return rawDesc;
}

function generateSmartPros(
  game: RawgGameDetail,
  steamReview: { total_positive: number; total_reviews: number; review_score_desc: string } | null,
  igdb: import("../external/igdb").IgdbGame | null,
  playerCount: number | null,
): string[] {
  const pros: string[] = [];

  // Steam review sentiment
  if (steamReview) {
    const pct = Math.round((steamReview.total_positive / steamReview.total_reviews) * 100);
    if (pct >= 90) pros.push(`${steamReview.review_score_desc} on Steam (${pct}% positive from ${(steamReview.total_reviews / 1000).toFixed(0)}K reviews)`);
    else if (pct >= 75) pros.push(`${steamReview.review_score_desc} Steam reviews (${pct}% positive)`);
  }

  // Active playerbase
  if (playerCount && playerCount > 5000) {
    pros.push(`Active community with ${playerCount.toLocaleString()} concurrent players`);
  } else if (playerCount && playerCount > 500) {
    pros.push(`Healthy player count of ${playerCount.toLocaleString()} concurrent`);
  }

  // IGDB rating
  if (igdb?.aggregated_rating && igdb.aggregated_rating >= 80) {
    pros.push(`Critically acclaimed (${Math.round(igdb.aggregated_rating)}/100 critic average)`);
  }

  // Genre-specific pros
  const genres = (game.genres ?? []).map(g => g.name.toLowerCase());
  const tags = (game.tags ?? []).map(t => t.name.toLowerCase());
  
  if (tags.includes("story rich") || tags.includes("narrative")) pros.push("Compelling narrative and story");
  if (tags.includes("open world") || tags.includes("exploration")) pros.push("Rich open world to explore");
  if (tags.includes("multiplayer") || tags.includes("co-op")) pros.push("Engaging multiplayer/co-op experience");
  if (tags.includes("great soundtrack") || tags.includes("soundtrack")) pros.push("Outstanding soundtrack");
  if (genres.includes("indie") && game.rating >= 4) pros.push("Standout indie gem");
  
  // RAWG rating fallback
  if (pros.length < 2 && game.rating >= 4) {
    pros.push(`Highly rated by ${game.ratings_count.toLocaleString()} players`);
  }

  if (pros.length === 0) pros.push("Unique gameplay concept");
  return pros.slice(0, 4);
}

function generateSmartCons(
  game: RawgGameDetail,
  steamReview: { total_positive: number; total_reviews: number; review_score_desc: string } | null,
  igdb: import("../external/igdb").IgdbGame | null,
): string[] {
  const cons: string[] = [];
  const tags = (game.tags ?? []).map(t => t.name.toLowerCase());

  if (steamReview) {
    const pct = Math.round((steamReview.total_positive / steamReview.total_reviews) * 100);
    if (pct < 70) cons.push(`Mixed Steam reception (${pct}% positive)`);
  }

  if (tags.includes("difficult") || tags.includes("souls-like")) cons.push("Steep difficulty curve may not appeal to casual players");
  if (tags.includes("early access")) cons.push("Still in Early Access — content may be incomplete");
  if (tags.includes("microtransactions") || tags.includes("in-app purchases")) cons.push("Contains microtransactions");
  if (tags.includes("grinding") || tags.includes("grindy")) cons.push("Can require significant grinding");

  if (game.rating < 3.5 && game.ratings_count > 100) {
    cons.push("Below-average player reception");
  }

  if (cons.length === 0) {
    if (!game.metacritic && !(igdb?.aggregated_rating)) {
      cons.push("Limited professional critic coverage");
    } else {
      cons.push("No significant drawbacks reported");
    }
  }
  return cons.slice(0, 3);
}
