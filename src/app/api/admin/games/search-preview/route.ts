/**
 * GET /api/admin/games/search-preview?q=elden+ring
 *
 * Searches RAWG, Google Play, and Apple App Store in parallel.
 * Returns unified candidate list so admin can pick from any platform.
 * Does NOT ingest — just returns metadata for verification.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonBadRequest } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { searchRawg } from "@/lib/external/rawg";
import { searchGooglePlay } from "@/lib/external/googleplay";
import { searchAppStore } from "@/lib/external/appstore";
import { getServerSupabase } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slugify";

export async function GET(request: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return jsonBadRequest("Missing query parameter ?q=");

  // Optional source filter: "rawg", "google_play", "app_store", or omit for all
  const sourceParam = request.nextUrl.searchParams.get("source")?.trim() || "all";
  const wantRawg = sourceParam === "all" || sourceParam === "rawg";
  const wantGplay = sourceParam === "all" || sourceParam === "google_play";
  const wantAppStore = sourceParam === "all" || sourceParam === "app_store";

  // Only search requested sources — avoids wasted API calls
  const [rawgResult, gplayResult, appStoreResult] = await Promise.allSettled([
    wantRawg ? searchRawg(q, 1, 8) : Promise.resolve({ results: [], count: 0, next: null, previous: null } as Awaited<ReturnType<typeof searchRawg>>),
    wantGplay ? searchGooglePlay(q, 6).catch(() => []) : Promise.resolve([]),
    wantAppStore ? searchAppStore(q, 6).catch(() => []) : Promise.resolve([]),
  ]);

  const rawgResults = rawgResult.status === "fulfilled" ? rawgResult.value.results : [];
  const gplayResults = gplayResult.status === "fulfilled" ? gplayResult.value : [];
  const appStoreResults = appStoreResult.status === "fulfilled" ? appStoreResult.value : [];

  // Collect all slugs to check DB for existing games
  const supabase = getServerSupabase();
  const allSlugs = [
    ...rawgResults.map((r) => r.slug),
    ...rawgResults.map((r) => slugify(r.name)),
    ...gplayResults.map((r) => slugify(r.title)),
    ...appStoreResults.map((r) => slugify(r.trackName)),
  ].filter(Boolean);
  const uniqueSlugs = [...new Set(allSlugs)];

  let existingSlugSet = new Set<string>();
  if (uniqueSlugs.length > 0) {
    const { data: existingGames } = await supabase
      .from("games")
      .select("slug")
      .in("slug", uniqueSlugs);
    existingSlugSet = new Set((existingGames ?? []).map((g) => (g as { slug: string }).slug));
  }

  // Also check by title (ilike) for the top query to catch title matches
  const { data: titleMatches } = await supabase
    .from("games")
    .select("slug, title")
    .ilike("title", `%${q}%`)
    .limit(5);
  for (const tm of titleMatches ?? []) {
    existingSlugSet.add((tm as { slug: string }).slug);
  }

  const isInDb = (name: string, slug?: string) => {
    if (slug && existingSlugSet.has(slug)) return true;
    if (existingSlugSet.has(slugify(name))) return true;
    return false;
  };

  // ── Build unified candidate list ──

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates: any[] = [];

  // RAWG results
  for (const r of rawgResults) {
    candidates.push({
      source: "rawg",
      rawgId: r.id,
      name: r.name,
      slug: r.slug,
      released: r.released,
      backgroundImage: r.background_image,
      rating: r.rating,
      ratingsCount: r.ratings_count,
      metacritic: r.metacritic,
      platforms: (r.platforms ?? []).map((p) => p.platform.name),
      genres: (r.genres ?? []).map((g) => g.name),
      developer: null,
      icon: null,
      score: null,
      installs: null,
      appId: null,
      trackId: null,
      storeUrl: null,
      alreadyInDb: isInDb(r.name, r.slug),
    });
  }

  // Google Play results
  for (const r of gplayResults) {
    candidates.push({
      source: "google_play",
      rawgId: null,
      name: r.title,
      slug: slugify(r.title),
      released: null,
      backgroundImage: null,
      rating: null,
      ratingsCount: null,
      metacritic: null,
      platforms: ["Android"],
      genres: r.genre ? [r.genre] : [],
      developer: r.developer,
      icon: r.icon,
      score: r.score,
      installs: r.installs || null,
      appId: r.appId,
      trackId: null,
      storeUrl: r.url || `https://play.google.com/store/apps/details?id=${r.appId}`,
      alreadyInDb: isInDb(r.title),
    });
  }

  // App Store results
  for (const r of appStoreResults) {
    candidates.push({
      source: "app_store",
      rawgId: null,
      name: r.trackName,
      slug: slugify(r.trackName),
      released: r.releaseDate ? r.releaseDate.split("T")[0] : null,
      backgroundImage: null,
      rating: null,
      ratingsCount: null,
      metacritic: null,
      platforms: ["iOS"],
      genres: r.genres?.length ? r.genres : [r.primaryGenreName].filter(Boolean),
      developer: r.artistName,
      icon: r.artworkUrl512 || r.artworkUrl100,
      score: r.averageUserRating,
      installs: null,
      appId: null,
      trackId: r.trackId,
      storeUrl: r.trackViewUrl,
      alreadyInDb: isInDb(r.trackName),
    });
  }

  return jsonOk({
    candidates,
    counts: {
      rawg: rawgResults.length,
      googlePlay: gplayResults.length,
      appStore: appStoreResults.length,
    },
  });
}
