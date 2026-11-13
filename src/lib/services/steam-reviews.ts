import { unstable_cache } from 'next/cache';
import type { SteamReviewsData } from '@/lib/api';
import { getPublicSupabase, hasPublicSupabaseEnv } from '@/lib/supabase/public';

const CACHE_TTL_MS = 72 * 60 * 60 * 1000;

// Public rendering is read-only. A bounded GitHub job owns upstream fetching
// and atomic cache replacement, so crawlers cannot trigger provider work.
const readCachedSteamReviews = unstable_cache(async (slug: string): Promise<SteamReviewsData> => {
  const empty: SteamReviewsData = {
    reviews: [], total: 0, steamAppId: null, source: 'empty',
    cache: { fetchedAt: null, ageMs: null, ttlMs: CACHE_TTL_MS, isStale: true },
  };
  if (!hasPublicSupabaseEnv() || !/^[a-z0-9-]{1,100}$/i.test(slug)) return empty;
  const supabase = getPublicSupabase();
  const { data: game, error: gameError } = await supabase.from('games')
    .select('id, steam_app_id, title, cover_image, header_image, steam_total_count')
    .eq('slug', slug).abortSignal(AbortSignal.timeout(4000)).maybeSingle();
  if (gameError) throw gameError;
  if (!game?.steam_app_id) return empty;
  const { data, error } = await supabase.from('steam_reviews')
    .select('id, recommendation_id, voted_up, review_text, playtime_at_review, playtime_forever, author_steam_id, authored_at, votes_up, votes_funny, weighted_vote_score, steam_purchase, fetched_at')
    .eq('game_id', game.id).eq('language', 'english')
    .order('weighted_vote_score', { ascending: false }).order('votes_up', { ascending: false }).limit(21)
    .abortSignal(AbortSignal.timeout(4000));
  if (error) throw error;
  const rows = data ?? [];
  const fetchedAt = rows[0]?.fetched_at ?? null;
  const ageMs = fetchedAt ? Math.max(0, Date.now() - Date.parse(fetchedAt)) : null;
  const stale = ageMs === null || ageMs >= CACHE_TTL_MS;
  return {
    reviews: rows.map(row => ({
      id: row.id, recommendationId: row.recommendation_id, votedUp: row.voted_up,
      reviewText: row.review_text, playtimeAtReview: row.playtime_at_review,
      playtimeForever: row.playtime_forever, authorSteamId: row.author_steam_id,
      authoredAt: row.authored_at, votesUp: row.votes_up, votesFunny: row.votes_funny,
      weightedVoteScore: row.weighted_vote_score, steamPurchase: row.steam_purchase,
    })),
    total: game.steam_total_count ?? rows.length, steamAppId: game.steam_app_id,
    gameTitle: game.title, coverImage: game.header_image || game.cover_image,
    source: rows.length ? (stale ? 'stale-cache' : 'cache') : 'empty',
    cache: { fetchedAt, ageMs, ttlMs: CACHE_TTL_MS, isStale: stale },
  };
}, ['steam-review-snapshots-v2'], { revalidate: 900 });

export async function loadSteamReviews(slug: string, limit = 3): Promise<SteamReviewsData> {
  const data = await readCachedSteamReviews(slug);
  const count = Number.isFinite(limit) ? Math.min(21, Math.max(1, Math.trunc(limit))) : 3;
  return { ...data, reviews: data.reviews.slice(0, count) };
}
