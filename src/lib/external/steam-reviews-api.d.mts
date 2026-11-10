export interface SteamReview {
  recommendationid: string;
  language: string;
  review: string;
  voted_up: boolean;
  votes_up: number;
  votes_funny: number;
  weighted_vote_score: number;
  steam_purchase: boolean;
  received_for_free: boolean;
  timestamp_created: number;
  timestamp_updated: number;
  author?: { steamid?: string; playtime_forever?: number; playtime_at_review?: number };
}
export interface SteamReviewsResponse {
  query_summary: { num_reviews: number; review_score: number; review_score_desc: string; total_positive: number; total_negative: number; total_reviews: number };
  reviews: SteamReview[];
  cursor?: string;
}
type ReviewOptions = { languages?: string[]; limit?: number; fetchOptions?: RequestInit & { next?: { revalidate: number } } };
export function buildSteamReviewsUrl(appId: number, options?: ReviewOptions): string;
export function fetchSteamReviews(appId: number, options?: ReviewOptions, fetcher?: typeof fetch): Promise<SteamReviewsResponse>;
