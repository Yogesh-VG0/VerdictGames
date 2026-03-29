/**
 * GET /api/search
 *
 * Full-text search across games with filter support.
 * Query params: q, platform, genre, year, monetization, sort, page
 *
 * Relevance ranking: title-similarity-first (50%), then quality (25%),
 * review volume (15%), and recency (10%).
 *
 * On-demand ingest: if a text query returns 0 results and no filters
 * are active, attempts to ingest the game from external sources.
 */

export const revalidate = 30; // ISR: short cache for search freshness

import { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api/response";
import { mapGameRow } from "@/lib/db/mappers";
import { GAME_CARD_COLUMNS_WITH_DESC } from "@/lib/db/columns";
import { confidenceWeightedScore, isSurfaceReady } from "@/lib/utils/quality";
import { isPublicSafeGame } from "@/lib/utils/publicSafety";
import { hasUsableCardImage } from "@/lib/utils/mediaReadiness";
import type { Game, PaginatedResponse, SortOption, Platform } from "@/lib/types";
import type { GameRow } from "@/lib/supabase/types";

const PAGE_SIZE = 25;

/* ─── Title Similarity Scoring ─── */

/**
 * Compute title similarity between query and a game title.
 * Returns 0-1 where 1 = exact match.
 *
 * Strategy:
 * - Exact match (case-insensitive) → 1.0
 * - Starts-with → 0.9 + length bonus
 * - Contains as word → 0.7 + position bonus
 * - Contains substring → 0.5 + length ratio
 * - Partial word overlap → 0.1-0.4 based on word overlap ratio
 */
function titleSimilarity(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();

  // Exact match
  if (q === t) return 1.0;

  // Title starts with query
  if (t.startsWith(q)) return 0.9 + Math.min(0.09, q.length / t.length * 0.09);

  // Query starts with title (user typed more than the title)
  if (q.startsWith(t)) return 0.85 + Math.min(0.09, t.length / q.length * 0.09);

  // Contains as whole word(s)
  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);

  // Check if all query words appear in title
  const allQueryWordsInTitle = qWords.every((qw) => tWords.some((tw) => tw.includes(qw)));
  if (allQueryWordsInTitle) {
    const wordOverlap = qWords.length / Math.max(tWords.length, 1);
    return 0.7 + Math.min(0.19, wordOverlap * 0.19);
  }

  // Contains as substring
  if (t.includes(q)) {
    const lengthRatio = q.length / t.length;
    return 0.5 + Math.min(0.19, lengthRatio * 0.19);
  }

  // Partial word overlap
  const matchingWords = qWords.filter((qw) => tWords.some((tw) => tw.includes(qw) || qw.includes(tw)));
  if (matchingWords.length > 0) {
    return 0.1 + (matchingWords.length / qWords.length) * 0.3;
  }

  return 0;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawQ = params.get("q") ?? "";
  // Sanitize: strip characters that could break PostgREST .or()/.cs.{} syntax
  const q = rawQ.replace(/[%_(),.;'"\\|{}\[\]]/g, "").trim().slice(0, 200);
  const platform = params.get("platform") ?? "All";
  const genre = params.get("genre") ?? "";
  const year = params.get("year") ?? "";
  const monetization = params.get("monetization") ?? "All";
  const sort = (params.get("sort") ?? "relevance") as SortOption;
  const rawPage = parseInt(params.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100) : 1;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const empty: PaginatedResponse<Game> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
      return jsonOk(empty);
    }

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    let query = supabase.from("games").select(GAME_CARD_COLUMNS_WITH_DESC, { count: "planned" });

    // Text search — ilike on title/developer/publisher (NOT description — too slow on large text)
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,developer.ilike.%${q}%,publisher.ilike.%${q}%`
      );
    }

    // Platform filter — supports family grouping (e.g. PlayStation = PS4 + PS5)
    // Also handles friendly URL slugs like "PlayStation" or "Xbox" or "Switch"
    // For Android/iOS: uses verified mobile_store_listings instead of RAWG platform tags.
    if (platform && platform !== "All") {
      const PLATFORM_FAMILIES: Record<string, string[]> = {
        "PlayStation 5": ["PlayStation 5", "PlayStation 4"],
        "Xbox Series X|S": ["Xbox Series X|S", "Xbox One"],
        "Nintendo Switch": ["Nintendo Switch", "Nintendo Switch 2"],
      };
      const PLATFORM_ALIASES: Record<string, string> = {
        "playstation": "PlayStation 5",
        "ps5": "PlayStation 5",
        "ps4": "PlayStation 5",
        "xbox": "Xbox Series X|S",
        "switch": "Nintendo Switch",
        "mac": "macOS",
        "macos": "macOS",
      };
      const resolved = PLATFORM_ALIASES[platform.toLowerCase()] ?? platform;

      // Mobile platforms: require a verified store listing, not just a RAWG tag
      const MOBILE_STORE_MAP: Record<string, string> = {
        "Android": "google_play",
        "iOS": "app_store",
      };
      const storeName = MOBILE_STORE_MAP[resolved];

      if (storeName) {
        // Subquery: only games with a verified mobile_store_listings row
        const { data: verifiedIds } = await supabase
          .from("mobile_store_listings")
          .select("game_id")
          .eq("store", storeName)
          .eq("is_verified", true);

        if (verifiedIds && verifiedIds.length > 0) {
          const ids = verifiedIds.map((r: { game_id: string }) => r.game_id);
          query = query.in("id", ids);
        } else {
          // No verified listings yet — fall back to platforms array
          // (graceful degradation until backfill runs)
          query = query.contains("platforms", [resolved]);
        }
      } else {
        const family = PLATFORM_FAMILIES[resolved];
        if (family) {
          query = query.or(family.map(p => `platforms.cs.{${p}}`).join(","));
        } else {
          query = query.contains("platforms", [resolved]);
        }
      }
    }

    // Genre filter
    if (genre) {
      query = query.contains("genres", [genre]);
    }

    // Year filter
    if (year) {
      query = query
        .gte("release_date", `${year}-01-01`)
        .lte("release_date", `${year}-12-31`);
    }

    // Monetization filter
    if (monetization && monetization !== "All") {
      query = query.eq("monetization", monetization);
    }

    // Sorting (tie-break on `id` for stable pagination across pages)
    const today = new Date().toISOString().slice(0, 10);
    switch (sort) {
      case "newest":
        // Only released games, newest first — require cover image + exclude provisional/COMING SOON
        query = query.lte("release_date", today)
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .or("is_provisional.is.null,is_provisional.eq.false")
          .neq("verdict_label", "COMING SOON")
          .order("release_date", { ascending: false }).order("id", { ascending: true });
        break;
      case "upcoming":
        // Only unreleased games, soonest first — require cover image for public-readiness
        query = query.gt("release_date", today)
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .order("release_date", { ascending: true }).order("id", { ascending: true });
        break;
      case "recently-added":
        // Newest DB entries — require cover image + score>0 + exclude provisional/COMING SOON
        query = query
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .gt("score", 0)
          .or("is_provisional.is.null,is_provisional.eq.false")
          .neq("verdict_label", "COMING SOON")
          .order("created_at", { ascending: false }).order("id", { ascending: true });
        break;
      case "top-rated":
        // Require minimum reviews so tiny-sample games don't enter the re-ranking pool
        query = query
          .gte("review_count", 10)
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .order("verdict_score", { ascending: false, nullsFirst: false })
          .order("score", { ascending: false })
          .order("id", { ascending: true });
        break;
      case "trending":
        // Prioritize cron-curated trending flag, then momentum, then players
        // Require cover image for public-readiness
        query = query
          .not("cover_image", "is", null)
          .neq("cover_image", "")
          .order("trending", { ascending: false, nullsFirst: false })
          .order("momentum", { ascending: false, nullsFirst: false })
          .order("current_players", { ascending: false, nullsFirst: false })
          .order("verdict_score", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true });
        break;
      default:
        // relevance — title-similarity-first ranking
        if (q) {
          // Overfetch for JS-side re-ranking by title similarity
          // We'll fetch up to 150 results and re-rank in JS
          query = query
            .order("verdict_score", { ascending: false, nullsFirst: false })
            .order("score", { ascending: false })
            .order("id", { ascending: true });
        } else {
          // No-query browsing: active + quality + recency for a good default browse
          // Trending flag groups active games first; verdict_score ranks within each group.
          // Score floor (>=55) excludes SKIP-rated games from default browse.
          query = query
            .gte("review_count", 10)
            .gte("score", 55)
            .not("cover_image", "is", null)
            .neq("cover_image", "")
            .order("trending", { ascending: false, nullsFirst: false })
            .order("verdict_score", { ascending: false, nullsFirst: false })
            .order("release_date", { ascending: false })
            .order("id", { ascending: true });
        }
        break;
    }

    // For relevance with query, we overfetch and re-rank by title similarity
    const isRelevanceWithQuery = sort === "relevance" && q;
    const isTopRated = sort === "top-rated";
    const start = (page - 1) * PAGE_SIZE;

    // UNDERFILL FIX: All sort modes now overfetch to account for post-filtering
    // Post-filters (public safety, media readiness, provisional exclusion) can remove items
    // Without overfetch, users get fewer than PAGE_SIZE items per page
    const OVERFETCH_MULTIPLIER = 3; // Fetch 3x to ensure enough after filtering

    if (isRelevanceWithQuery) {
      // Adaptive overfetch: 150 results for title similarity re-ranking
      const overfetchSize = 150;
      query = query.range(0, overfetchSize - 1);
    } else if (isTopRated) {
      // Fetch enough rows to cover at least `page * PAGE_SIZE` after re-ranking
      const trFetchEnd = Math.max(page * PAGE_SIZE * 4, 200);
      query = query.range(0, trFetchEnd - 1);
    } else {
      // All other sorts: overfetch from page start to allow for post-filter drops
      const overfetchEnd = start + (PAGE_SIZE * OVERFETCH_MULTIPLIER) - 1;
      query = query.range(start, overfetchEnd);
    }

    const { data, error, count } = await query as unknown as { data: GameRow[] | null; error: unknown; count: number | null };

    if (error) throw error;

    // Apply public safety + media readiness filters
    // Filter logic varies by sort mode:
    // - "upcoming": KEEP future releases, exclude released/provisional
    // - others: exclude future releases and provisional/COMING SOON
    const JUST_RELEASED_DAYS = 14;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = new Date(todayStr + "T00:00:00").getTime();
    const isUpcoming = sort === "upcoming";
    const isTrending = sort === "trending";

    let rows = (data ?? []).filter((r) => {
      if (!isPublicSafeGame(r) || !hasUsableCardImage(r)) return false;
      
      if (isUpcoming) {
        // Upcoming: KEEP future releases, require release_date > today
        if (!r.release_date || r.release_date <= todayStr) return false;
        return true;
      }
      
      // Non-upcoming sorts: exclude provisional and future releases
      if ((r as GameRow & { is_provisional?: boolean }).is_provisional) return false;
      if (r.verdict_label === "COMING SOON") return false;
      if (r.release_date && r.release_date > todayStr) return false;
      
      // Exclude 0-review games that are past the "just released" window
      const reviewCount = r.review_count ?? 0;
      if (reviewCount === 0 && r.release_date) {
        const releaseMs = new Date(r.release_date + "T00:00:00").getTime();
        const daysSinceRelease = (todayMs - releaseMs) / (1000 * 60 * 60 * 24);
        if (daysSinceRelease > JUST_RELEASED_DAYS) return false;
      }
      
      // Browse trending: exclude games with significant negative momentum ("Falling")
      if (isTrending) {
        const momentum = (r as GameRow & { momentum?: number }).momentum ?? 0;
        if (momentum < -0.1) return false;
      }
      
      return true;
    });

    // ─── Relevance re-ranking: title similarity first ───
    if (isRelevanceWithQuery && rows.length > 0) {
      // Compute composite relevance score:
      // 50% title similarity, 25% quality, 15% review volume, 10% recency
      const scored = rows.map((row) => {
        const sim = titleSimilarity(q, row.title);
        const quality = Math.min(1, confidenceWeightedScore(row) / 100);
        const volume = Math.min(1, Math.log10((row.review_count ?? 0) + 1) / 6);
        const ageMs = row.release_date
          ? Date.now() - new Date(row.release_date).getTime()
          : Infinity;
        const ageDays = ageMs / 86400000;
        const recency = ageDays < 365 ? 1 : ageDays < 730 ? 0.8 : ageDays < 1825 ? 0.6 : 0.3;

        // Surface readiness bonus: complete games rank slightly higher
        const readiness = isSurfaceReady(row, "searchResult") ? 0.05 : 0;

        const relevance = (sim * 0.50) + (quality * 0.25) + (volume * 0.15) + (recency * 0.10) + readiness;
        return { row, relevance, sim };
      });

      scored.sort((a, b) => b.relevance - a.relevance);
      rows = scored.slice(start, start + PAGE_SIZE).map((s) => s.row);
    }

    // Re-sort top-rated by confidence-weighted score so tiny-sample 100% games don't dominate
    if (isTopRated && rows.length > 0) {
      rows.sort((a, b) => confidenceWeightedScore(b) - confidenceWeightedScore(a));
      rows = rows.slice(start, start + PAGE_SIZE);
    }

    // For other sort modes: slice to PAGE_SIZE after overfetch + filter
    if (!isRelevanceWithQuery && !isTopRated) {
      rows = rows.slice(0, PAGE_SIZE);
    }

    const games = rows.map(mapGameRow);
    // Use filtered count for consistency - DB count may include items removed by post-filters
    // For upcoming/trending/etc., the post-filter may remove items, so total should reflect actual results
    let total = rows.length;
    // For paginated queries, estimate total from DB count but cap at filtered reality
    if (!isRelevanceWithQuery && !isTopRated) {
      // If we got a full page, there are likely more - use DB count as estimate
      // but if we got fewer items than requested after filtering, that's the real total
      const dbCount = count ?? 0;
      if (rows.length >= PAGE_SIZE) {
        total = dbCount; // Likely more pages available
      }
    }

    // ── 3-layer search: DB → RAWG instant preview → background ingest ──
    const noFilters = platform === "All" && !genre && !year && monetization === "All";
    if (total < 3 && q.length >= 2 && page === 1 && noFilters) {
      try {
        // Layer 2: RAWG instant search for immediate results
        const { searchRawg, mapRawgPlatforms } = await import("@/lib/external/rawg");
        const rawgResults = await searchRawg(q, 1, 5);
        const { normalizeTitle } = await import("@/lib/utils/slugify");
        const existingSlugs = new Set(games.map((g) => normalizeTitle(g.title)));

        if (rawgResults.results.length > 0) {
          // Show RAWG results instantly as preview cards
          for (const rg of rawgResults.results) {
            if (existingSlugs.has(normalizeTitle(rg.name))) continue;
            const previewGame: Game = {
              id: `rawg-${rg.id}`,
              slug: rg.slug,
              title: rg.name,
              coverImage: rg.background_image ?? "",
              headerImage: rg.background_image ?? "",
              screenshots: (rg.short_screenshots ?? []).map((s) => s.image),
              platforms: mapRawgPlatforms(rg.platforms) as Platform[],
              genres: (rg.genres ?? []).map((g) => g.name),
              tags: (rg.tags ?? []).slice(0, 6).map((t) => t.name),
              developer: "",
              publisher: "",
              releaseDate: rg.released ?? "",
              description: "",
              score: rg.metacritic ?? Math.round((rg.rating || 3) * 20),
              verdictLabel: rg.metacritic && rg.metacritic >= 80 ? "MUST PLAY" : rg.metacritic && rg.metacritic >= 65 ? "WORTH IT" : rg.metacritic && rg.metacritic >= 45 ? "MIXED" : "MIXED",
              verdictSummary: "",
              pros: [],
              cons: [],
              monetization: "Paid",
              performanceNotes: "",
              monetizationNotes: "",
              reviewCount: rg.ratings_count ?? 0,
              rawgRating: rg.rating,
              rawgMetacritic: rg.metacritic ?? undefined,
              subtitle: "",
            };
            games.push(previewGame);
            existingSlugs.add(normalizeTitle(rg.name));
          }
          total = games.length;
        }

        // Layer 3 REMOVED: no auto-ingest from search typing.
        // Ingest only happens on explicit game page visit or admin action.
      } catch (ingestErr) {
        console.warn("[API] /search on-demand ingest failed:", ingestErr);
      }
    }

    const paginatedResult: PaginatedResponse<Game> = {
      items: games,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: start + PAGE_SIZE < total,
    };

    return jsonOk(paginatedResult, 200, { cache: true });
  } catch (err) {
    console.error("[API] /search error:", err);
    const empty: PaginatedResponse<Game> = { items: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false };
    return jsonOk(empty);
  }
}
