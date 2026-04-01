import { describe, expect, it } from "vitest";
import type { GameRow } from "../../supabase/types";
import {
  getPublicTrendingScore,
  hasBrowseTrendingSignal,
  isAcceptableTrendingCandidate,
  isPremiumTrendingCandidate,
} from "../trending";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function makeGameRow(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "00000000-0000-0000-0000-000000000099",
    slug: "test-game",
    title: "Test Game",
    subtitle: null,
    cover_image: "https://example.com/cover.jpg",
    header_image: "https://example.com/header.jpg",
    screenshots: [],
    platforms: ["PC"],
    genres: ["Action"],
    tags: ["Singleplayer"],
    developer: "Test Dev",
    publisher: "Test Pub",
    release_date: isoDaysAgo(45),
    description: "A polished discovery-ready test game description.",
    score: 86,
    verdict_label: "WORTH IT",
    verdict_summary: "Solid game.",
    pros: ["Great gameplay"],
    cons: ["Short"],
    review_count: 1000,
    user_score: 88,
    steam_positive_count: 880,
    steam_total_count: 1000,
    community_score: 86,
    critic_score: 84,
    critic_source_count: 0,
    confidence: 0.52,
    verdict_score: 87,
    monetization: "Paid",
    performance_notes: "",
    monetization_notes: "",
    steam_url: "https://store.steampowered.com/app/12345",
    play_store_url: null,
    featured: false,
    trending: false,
    rawg_id: 12345,
    steam_app_id: 12345,
    price_current: 2999,
    price_currency: "USD",
    price_lowest: 1499,
    price_deal_url: null,
    is_free: false,
    current_players: 250,
    peak_players_24h: null,
    players_updated_at: null,
    trailer_url: null,
    trailer_thumbnail: null,
    igdb_id: null,
    igdb_url: null,
    igdb_rating: null,
    igdb_summary: null,
    wikipedia_url: null,
    wikipedia_excerpt: null,
    metacritic_url: null,
    website_url: null,
    reddit_url: null,
    cheapshark_id: null,
    steam_rating_label: "Very Positive",
    rawg_metacritic: null,
    rawg_rating: null,
    score_source: "steam",
    last_enriched_at: new Date().toISOString(),
    enrichment_sources: ["rawg", "steam"],
    hltb_main: null,
    hltb_extras: null,
    hltb_completionist: null,
    hltb_last_fetched: null,
    franchise: null,
    momentum: 0.08,
    is_featured_manual: false,
    is_trending_manual: false,
    manual_score: null,
    is_provisional: false,
    release_status: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("trending signal gates", () => {
  it("rejects evergreen quality games without a current trend signal", () => {
    const evergreen = makeGameRow({
      release_date: isoDaysAgo(365 * 6),
      review_count: 12000,
      current_players: 3200,
      momentum: 0,
      score: 92,
      verdict_score: 91,
      confidence: 0.8,
    });

    expect(isPremiumTrendingCandidate(evergreen)).toBe(false);
    expect(isAcceptableTrendingCandidate(evergreen)).toBe(false);
    expect(hasBrowseTrendingSignal(evergreen)).toBe(false);
  });

  it("accepts a recent breakout with momentum and activity", () => {
    const breakout = makeGameRow({
      release_date: isoDaysAgo(20),
      review_count: 220,
      current_players: 900,
      momentum: 0.16,
      score: 82,
      verdict_score: 84,
    });

    expect(isPremiumTrendingCandidate(breakout)).toBe(true);
    expect(isAcceptableTrendingCandidate(breakout)).toBe(true);
    expect(hasBrowseTrendingSignal(breakout)).toBe(true);
  });

  it("keeps strongly flagged high-activity games while ranking breakouts higher", () => {
    const flagged = makeGameRow({
      release_date: isoDaysAgo(400),
      trending: true,
      current_players: 7000,
      momentum: -0.01,
      score: 80,
      verdict_score: 81,
    });
    const breakout = makeGameRow({
      id: "00000000-0000-0000-0000-000000000100",
      slug: "breakout-game",
      release_date: isoDaysAgo(14),
      current_players: 1400,
      momentum: 0.22,
      review_count: 260,
      score: 83,
      verdict_score: 84,
    });

    expect(hasBrowseTrendingSignal(flagged)).toBe(true);
    expect(getPublicTrendingScore(breakout)).toBeGreaterThan(getPublicTrendingScore(flagged));
  });
});
