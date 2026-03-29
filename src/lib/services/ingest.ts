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
import { validateSteamCover, findValidCoverUrl } from "../utils/mediaReadiness";
import { findGameWikiSummary } from "../external/wikipedia";
import { fetchHLTBData } from "../external/howlongtobeat";
import { slugify } from "../utils/slugify";
import { scoreToVerdict } from "../utils/score";
import {
  computeCommunityScore,
  computeCriticScore,
  computeConfidence,
  computeVerdictScore,
  getVerdictLabel,
  rawgRatingToPositiveRatio,
} from "../utils/scoring";

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
  forceRefresh?: boolean;
  /** When set, prefer the RAWG result whose slug most closely matches this. */
  expectedSlug?: string;
}

/* ───────── Slug Blocklist ───────── */
// Games that should never be ingested (typo entries, duplicates, spam)
const BLOCKED_SLUGS = new Set([
  "grand-theft-aito-vi",   // typo duplicate of grand-theft-auto-vi
]);

/* ───────── Main Ingestion Function ───────── */

export async function ingestGame(options: IngestOptions): Promise<IngestResult> {
  const { query, forceRefresh = false, expectedSlug } = options;
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

  // Pick the best match using title-first scoring.
  // CRITICAL: Title similarity MUST outweigh popularity/rating.
  // This prevents "CLASH ROYAL" from drifting to "Persona 5 Royal".
  const normalizeForCompare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  // Extract trailing numeral from slug for sequel detection (e.g. "vi", "2", "iii")
  const extractTrailingNumeral = (s: string): string | null => {
    const normalized = s.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const match = normalized.match(/[-]?(vi{0,3}|iv|ix|[0-9]+)$/);
    return match ? match[1] : null;
  };

  // Token overlap: what fraction of query tokens appear in the result
  const tokenOverlap = (queryTokens: string[], resultTitle: string): number => {
    const resultTokens = new Set(tokenize(resultTitle));
    if (queryTokens.length === 0) return 0;
    const matched = queryTokens.filter(t => resultTokens.has(t)).length;
    return matched / queryTokens.length;
  };

  const queryNorm = normalizeForCompare(query);
  const queryTokens = tokenize(query);
  const expectedNorm = expectedSlug ? normalizeForCompare(expectedSlug) : queryNorm;
  const expectedNumeral = expectedSlug ? extractTrailingNumeral(expectedSlug) : extractTrailingNumeral(query);

  const scoreOf = (r: typeof searchResults.results[0]) => {
    // Base: small popularity bonus (max ~5 points, never enough to override title)
    let s = (r.released ? 1 : 0) + (r.rating ? 1 : 0) + Math.min((r.ratings_count ?? 0) / 5000, 3);

    const rSlug = normalizeForCompare(r.slug ?? r.name);
    const rTitleNorm = normalizeForCompare(r.name);

    // === Title matching (heavily weighted) ===
    // Exact normalized slug match
    if (rSlug === expectedNorm) s += 100;
    // Exact normalized title match
    else if (rTitleNorm === expectedNorm) s += 90;
    // startsWith match (query is prefix of result or vice versa)
    else if (rTitleNorm.startsWith(expectedNorm) || expectedNorm.startsWith(rTitleNorm)) s += 60;
    else {
      // Token overlap scoring (0-50 points)
      const overlap = tokenOverlap(queryTokens, r.name);
      s += Math.round(overlap * 50);
    }

    // Sequel guard: mismatched trailing numeral is a hard reject
    if (expectedNumeral) {
      const resultNumeral = extractTrailingNumeral(r.slug ?? r.name);
      if (resultNumeral !== expectedNumeral) s -= 200;
    }

    return s;
  };

  const bestMatch = searchResults.results.reduce((best, cur) => {
    return scoreOf(cur) > scoreOf(best) ? cur : best;
  }, searchResults.results[0]);

  // Confidence check: if no high-confidence match found, signal low confidence
  const bestScore = scoreOf(bestMatch);

  if (bestScore < 30) {
    return {
      success: false,
      gameId: null,
      slug: null,
      message: `No high-confidence match for "${query}" (best score: ${bestScore}). Create a provisional page instead.`,
      alreadyExisted: false,
      lowConfidence: true,
    } as IngestResult & { lowConfidence: true };
  }

  const slug = slugify(bestMatch.name);

  // ── Block known-bad slugs from being re-ingested ──
  if (BLOCKED_SLUGS.has(slug)) {
    return {
      success: false,
      gameId: null,
      slug: null,
      message: `Slug "${slug}" is blocklisted and will not be ingested.`,
      alreadyExisted: false,
    };
  }

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
    hltbData,
  ] = await Promise.all([
    steamAppId ? getSteamReviewSummary(steamAppId) : Promise.resolve(null),
    steamAppId ? getSteamAppDetails(steamAppId) : Promise.resolve(null),
    steamAppId ? getSteamPlayerCount(steamAppId) : Promise.resolve(null),
    findCheapSharkDeal(fullGame.name, steamAppId).catch(() => null),
    isIgdbConfigured()
      ? findIgdbMatch(
          fullGame.name,
          fullGame.released ? new Date(fullGame.released).getFullYear() : undefined
        ).catch(() => null)
      : Promise.resolve(null),
    findGameWikiSummary(fullGame.name).catch(() => null),
    fetchHLTBData(fullGame.name).catch(() => null),
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

  const freeIndicators = ["free-to-play", "free to play", "f2p"];
  const allTags = [
    ...(fullGame.tags ?? []).map((t) => t.name.toLowerCase()),
    ...(fullGame.genres ?? []).map((g) => g.name.toLowerCase()),
  ];
  const hasFreeTag = allTags.some((t) => freeIndicators.includes(t));

  // ── Step 7: Process CheapShark data ──
  let cheapsharkId: string | null = null;
  let priceCurrent: number | null = steamPrice?.priceCurrent ?? null;
  const priceCurrency: string = steamPrice?.priceCurrency ?? "USD";
  let priceLowest: number | null = null;
  let priceDealUrl: string | null = null;
  let isFree: boolean = steamPrice?.isFree ?? hasFreeTag;

  if (hasFreeTag) {
    isFree = true;
    priceCurrent = 0;
  }

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

  // ── Step 8b: Process HLTB data ──
  if (hltbData) {
    enrichmentSources.push("hltb");
  }

  // ── Step 9: Process Wikipedia data ──
  let wikipediaUrl: string | null = igdbEnrichment?.wikipediaUrl ?? null;
  let wikipediaExcerpt: string | null = null;
  if (wikiData) {
    wikipediaExcerpt = wikiData.excerpt;
    wikipediaUrl = wikiData.url;
    enrichmentSources.push("wikipedia");
  }

  // ── Step 10: Compute score (v2 multi-signal) ──
  // Legacy score: waterfall pick for backward compatibility
  let scoreSource = "blended";
  const legacyScore = (() => {
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

  // ── Step 10b: Compute v2 scoring signals ──
  const steamPositiveCount = steamReviewData?.total_positive ?? null;
  const steamTotalCount = steamReviewData?.total_reviews ?? null;

  // Community score: Wilson Lower Bound of positive ratio
  let communityScore: number | null = null;
  if (steamPositiveCount != null && steamTotalCount != null && steamTotalCount > 0) {
    communityScore = computeCommunityScore(steamPositiveCount, steamTotalCount);
  } else if (fullGame.rating && fullGame.ratings_count && fullGame.ratings_count > 0) {
    // Fallback: approximate from RAWG user rating
    const { positive, total } = rawgRatingToPositiveRatio(fullGame.rating, fullGame.ratings_count);
    communityScore = computeCommunityScore(positive, total);
  }

  // Critic score: normalized average of IGDB + Metacritic
  const { score: criticScore, sourceCount: criticSourceCount } = computeCriticScore(
    igdbEnrichment?.igdbRating ?? null,
    fullGame.metacritic ?? null
  );

  // Confidence: how much we trust the verdict
  const reviewCount = steamReviewCount || fullGame.ratings_count || 0;
  const confidence = computeConfidence(reviewCount, criticSourceCount, steamReviewData != null);

  // Verdict score: final blended score
  const verdictScoreValue = computeVerdictScore(communityScore, criticScore, confidence);

  // Use verdict_score for the display score, fall back to legacy
  const score = verdictScoreValue > 0 ? verdictScoreValue : legacyScore;

  // Determine if upcoming or just released
  const releaseDate = fullGame.released ?? null;
  const isUpcoming = releaseDate ? new Date(releaseDate) > new Date() : false;
  const isJustReleasedForLabel = releaseDate
    ? (Date.now() - new Date(releaseDate).getTime()) < 14 * 86400000 && reviewCount < 20
    : false;

  const verdictLabel = verdictScoreValue > 0
    ? getVerdictLabel(verdictScoreValue, confidence, isUpcoming, isJustReleasedForLabel)
    : scoreToVerdict(score);

  // ── Step 11: Build game record ──
  const screenshotUrls = screenshots.map((s) => s.image);
  const platforms = mapRawgPlatforms(fullGame.platforms);
  const genres = (fullGame.genres ?? []).map((g) => g.name);
  const tags = (fullGame.tags ?? []).slice(0, 12).map((t) => t.name);
  const developer = fullGame.developers?.[0]?.name ?? "";
  const publisher = fullGame.publishers?.[0]?.name ?? "";

  // Cover image priority: Steam library capsule > IGDB cover > RAWG background
  // Steam capsules don't exist for all games — validate before using
  const igdbCover = igdbEnrichment?.coverImageUrl ?? null;
  const igdbScreenshots = igdbEnrichment?.screenshotUrls ?? [];
  const rawgCover = fullGame.background_image || "";

  // Validate Steam cover URL (async) — fall back to IGDB or RAWG if 404
  let finalCover: string;
  let mediaSource: string | null = null;
  if (steamAppId) {
    const validSteamCover = await validateSteamCover(steamAppId);
    if (validSteamCover) {
      finalCover = validSteamCover;
      mediaSource = "steam";
    } else if (igdbCover) {
      finalCover = igdbCover;
      mediaSource = "igdb";
    } else {
      finalCover = rawgCover;
      mediaSource = rawgCover ? "rawg" : null;
    }
  } else if (igdbCover) {
    finalCover = igdbCover;
    mediaSource = "igdb";
  } else {
    finalCover = rawgCover;
    mediaSource = rawgCover ? "rawg" : null;
  }

  const finalScreenshots = igdbScreenshots.length > 0 ? igdbScreenshots : screenshotUrls;
  const finalHeader = igdbScreenshots.length > 0
    ? igdbScreenshots[0]
    : (fullGame.background_image_additional ?? fullGame.background_image ?? "");

  const gameRecord = {
    slug,
    title: fullGame.name,
    subtitle: null,
    cover_image: finalCover,
    header_image: finalHeader,
    screenshots: finalScreenshots,
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
    review_count: reviewCount,

    // Verdict Scoring v2
    steam_positive_count: steamPositiveCount,
    steam_total_count: steamTotalCount,
    community_score: communityScore,
    critic_score: criticScore,
    critic_source_count: criticSourceCount,
    confidence,
    verdict_score: verdictScoreValue > 0 ? verdictScoreValue : 0,
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
    hltb_main: hltbData?.main ?? null,
    hltb_extras: hltbData?.extras ?? null,
    hltb_completionist: hltbData?.completionist ?? null,
    hltb_last_fetched: hltbData ? new Date().toISOString() : null,
    last_enriched_at: new Date().toISOString(),
    enrichment_sources: enrichmentSources,
    media_source: mediaSource,
  };

  // ── Step 12: Upsert game ──
  let gameId: string;

  if (existing && forceRefresh) {
    // Update existing record
     
    const { error: updateError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
     
    const { data: inserted, error: insertError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // ── Step 14: Verify mobile store listings (non-blocking) ──
  // If RAWG says the game is on Android/iOS, try to verify via real store lookups.
  // This runs in the background and doesn't block the ingest response.
  const hasAndroidTag = platforms.includes("Android");
  const hasIOSTag = platforms.includes("iOS");
  if (hasAndroidTag || hasIOSTag) {
    verifyMobileListings(gameId, fullGame.name, playStoreUrl, hasAndroidTag, hasIOSTag, developer).catch(
      (err) => console.warn("[ingest] mobile verification failed:", (err as Error).message)
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
  const g1 = genres[0]?.toLowerCase() ?? "game";
  // Use title hash for deterministic variety
  const hash = title.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const variant = hash % 4;

  if (score >= 90) {
    const options = [
      `${title} is an exceptional ${genreStr} that raises the bar for the genre.`,
      `A masterclass in ${g1} design, ${title} delivers an unforgettable experience from start to finish.`,
      `${title} stands out as one of the best ${genreStr} titles in recent memory.`,
      `With near-perfect execution, ${title} is a must-play for any ${g1} fan.`,
    ];
    return options[variant];
  }
  if (score >= 75) {
    const options = [
      `${title} is a strong ${genreStr} that delivers where it counts.`,
      `A well-crafted ${g1} experience, ${title} is well worth your time.`,
      `${title} confidently hits its marks as a quality ${genreStr} title.`,
      `Fans of the ${g1} genre will find plenty to enjoy in ${title}.`,
    ];
    return options[variant];
  }
  if (score >= 50) {
    const options = [
      `${title} has interesting ideas but inconsistent execution holds it back.`,
      `A mixed bag, ${title} shows flashes of brilliance alongside notable shortcomings.`,
      `${title} offers a decent ${genreStr} experience but doesn't quite reach its potential.`,
      `There's fun to be had in ${title}, though it may not appeal to everyone.`,
    ];
    return options[variant];
  }
  const options = [
    `${title} struggles to deliver on its ${genreStr} ambitions.`,
    `Despite some effort, ${title} falls short of expectations in key areas.`,
    `${title} has fundamental issues that make it difficult to recommend.`,
    `Only for the most dedicated ${g1} fans — ${title} needs significant improvements.`,
  ];
  return options[variant];
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
    if (pct >= 90) {
      const total = steamReview.total_reviews;
      const countStr = total >= 1000 ? `${(total / 1000).toFixed(total >= 10000 ? 0 : 1)}K` : String(total);
      pros.push(`${steamReview.review_score_desc} on Steam (${pct}% positive from ${countStr} reviews)`);
    } else if (pct >= 75) pros.push(`${steamReview.review_score_desc} Steam reviews (${pct}% positive)`);
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

/* ───────── Mobile Store Verification ───────── */

/**
 * Confidence-tiered matching for mobile store results.
 *
 * HIGH (auto-attach):
 *   - Exact store URL / package name match (from RAWG), OR
 *   - Title similarity ≥ 90%, OR
 *   - Title similarity ≥ 80% AND developer name overlaps
 *
 * SKIP (never auto-attach):
 *   - Title similarity < 80% without developer match
 *   - Anything that looks like a different edition (HD, Lite, Free, SE, etc.)
 *     unless our canonical title also has that suffix
 */
function isHighConfidenceMatch(
  gameTitle: string,
  gameDev: string,
  storeTitle: string,
  storeDev: string,
  similarity: number,
): boolean {
  // Tier 1: very high title similarity — auto-accept
  if (similarity >= 90) return true;

  // Tier 2: good title similarity + developer cross-check
  if (similarity >= 80) {
    const devA = gameDev.toLowerCase().replace(/[^a-z0-9]/g, "");
    const devB = storeDev.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (devA && devB && (devA.includes(devB) || devB.includes(devA))) return true;
    // Also accept if dev names share significant tokens
    const tokA = new Set(gameDev.toLowerCase().split(/\s+/).filter(t => t.length > 2));
    const tokB = new Set(storeDev.toLowerCase().split(/\s+/).filter(t => t.length > 2));
    const overlap = [...tokA].filter(t => tokB.has(t)).length;
    if (overlap >= 1 && (tokA.size <= 3 || tokB.size <= 3)) return true;
  }

  return false;
}

/**
 * Verify mobile store listings for a game and upsert into mobile_store_listings.
 * Called as a non-blocking background task during ingest.
 *
 * Uses confidence-tiered matching:
 * - Exact package/URL match → auto-attach
 * - High title similarity + developer match → auto-attach
 * - Below threshold → skip (no bad merges)
 */
async function verifyMobileListings(
  gameId: string,
  gameTitle: string,
  playStoreUrl: string | null,
  hasAndroid: boolean,
  hasIOS: boolean,
  gameDeveloper = "",
): Promise<void> {
  const { getServerSupabase } = await import("../supabase/server");
  const supabase = getServerSupabase();

  // ── Android verification via google-play-scraper ──
  if (hasAndroid) {
    try {
      const {
        searchGooglePlay,
        getGooglePlayApp,
        extractPackageName,
        titleSimilarity,
      } = await import("../external/googleplay");

      let packageName = playStoreUrl ? extractPackageName(playStoreUrl) : null;
      let appData = packageName ? await getGooglePlayApp(packageName) : null;
      const matchedViaUrl = !!appData;

      // If no direct package name, search by title with tiered matching
      if (!appData) {
        const results = await searchGooglePlay(gameTitle, 5);
        for (const r of results) {
          const sim = titleSimilarity(gameTitle, r.title);
          if (isHighConfidenceMatch(gameTitle, gameDeveloper, r.title, r.developer ?? "", sim)) {
            packageName = r.appId;
            appData = await getGooglePlayApp(r.appId);
            break;
          }
        }
      }

      if (appData && packageName) {
        // Double-check: if matched via search (not URL), verify the store result
        // is actually a game and not a utility app with a similar name
        if (!matchedViaUrl && appData.genreId && !appData.genreId.startsWith("GAME")) {
          console.warn(`[ingest] Android match for "${gameTitle}" is not a game (${appData.genreId}), skipping`);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("mobile_store_listings") as any).upsert(
            {
              game_id: gameId,
              store: "google_play",
              external_id: packageName,
              store_url: appData.url,
              title: appData.title,
              developer: appData.developer,
              icon_url: appData.icon,
              header_image_url: appData.headerImage ?? null,
              screenshots: appData.screenshots?.slice(0, 8) ?? [],
              rating_average: appData.score,
              rating_count: appData.ratings,
              review_count: appData.reviews,
              installs: appData.installs,
              real_installs: appData.maxInstalls ?? null,
              price: appData.price,
              currency: appData.currency,
              is_free: appData.free,
              offers_iap: appData.offersIAP,
              iap_range: appData.inAppProductPrice ?? null,
              genre: appData.genre,
              genre_id: appData.genreId,
              content_rating: appData.contentRating ?? null,
              version: appData.version ?? null,
              released_at: appData.released ?? null,
              last_updated_at: appData.updated
                ? new Date(appData.updated * 1000).toISOString()
                : null,
              is_verified: true,
              last_verified_at: new Date().toISOString(),
              raw_data: appData as unknown as Record<string, unknown>,
            },
            { onConflict: "store,external_id" }
          );

          // Also update the game's play_store_url if we found one
          if (!playStoreUrl && appData.url) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("games") as any)
              .update({ play_store_url: appData.url })
              .eq("id", gameId);
          }
        }
      }
    } catch (err) {
      console.warn("[ingest] Android verification failed:", (err as Error).message);
    }
  }

  // ── iOS verification via Apple iTunes Search API ──
  if (hasIOS) {
    try {
      const { searchAppStore } = await import("../external/appstore");
      const { titleSimilarity } = await import("../external/googleplay");

      const results = await searchAppStore(gameTitle, 5);

      let bestMatch = null;
      for (const r of results) {
        const sim = titleSimilarity(gameTitle, r.trackName);
        if (isHighConfidenceMatch(gameTitle, gameDeveloper, r.trackName, r.artistName ?? "", sim)) {
          bestMatch = r;
          break;
        }
      }

      if (bestMatch) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("mobile_store_listings") as any).upsert(
          {
            game_id: gameId,
            store: "app_store",
            external_id: String(bestMatch.trackId),
            store_url: bestMatch.trackViewUrl,
            title: bestMatch.trackName,
            developer: bestMatch.artistName,
            icon_url: bestMatch.artworkUrl512 || bestMatch.artworkUrl100,
            header_image_url: null,
            screenshots: bestMatch.screenshotUrls?.slice(0, 8) ?? [],
            rating_average: bestMatch.averageUserRating,
            rating_count: bestMatch.userRatingCount,
            review_count: 0,
            installs: null,
            real_installs: null,
            price: bestMatch.price,
            currency: bestMatch.currency,
            is_free: bestMatch.price === 0,
            offers_iap: false,
            iap_range: null,
            genre: bestMatch.primaryGenreName,
            genre_id: null,
            content_rating: bestMatch.contentAdvisoryRating ?? null,
            version: bestMatch.version ?? null,
            released_at: bestMatch.releaseDate ?? null,
            last_updated_at: bestMatch.currentVersionReleaseDate ?? null,
            is_verified: true,
            last_verified_at: new Date().toISOString(),
            raw_data: bestMatch as unknown as Record<string, unknown>,
          },
          { onConflict: "store,external_id" }
        );
      }
    } catch (err) {
      console.warn("[ingest] iOS verification failed:", (err as Error).message);
    }
  }
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
