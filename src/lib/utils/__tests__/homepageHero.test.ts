import { describe, expect, it } from "vitest";
import type { GameRow } from "../../supabase/types";
import { getHomepageHeroScore, isHomepageHeroAutoCandidate } from "../homepageHero";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function makeGameRow(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "00000000-0000-0000-0000-000000000199",
    slug: "test-game",
    title: "Test Game",
    subtitle: null,
    cover_image: "https://example.com/cover.jpg",
    header_image: "https://example.com/header.jpg",
    screenshots: ["https://example.com/shot-1.jpg"],
    platforms: ["PC"],
    genres: ["Action"],
    tags: ["Singleplayer"],
    developer: "Test Dev",
    publisher: "Test Pub",
    release_date: isoDaysAgo(45),
    description: "A polished discovery-ready test game description that is long enough for homepage surfaces.",
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

describe("homepage hero auto candidates", () => {
  it("rejects a mid-scale recent hit that is good enough for rails but not flagship hero", () => {
    const candidate = makeGameRow({
      title: "Ball x Pit",
      slug: "ball-x-pit",
      release_date: isoDaysAgo(170),
      review_count: 23812,
      steam_total_count: 23812,
      steam_positive_count: 22860,
      current_players: 1929,
      momentum: 0.03,
      verdict_score: 91,
      score: 91,
      critic_score: 84,
      igdb_rating: 84,
      confidence: 0.86,
      trending: true,
    });

    expect(isHomepageHeroAutoCandidate(candidate)).toBe(false);
  });

  it("rejects an older critically-backed game with only modest live presence", () => {
    const candidate = makeGameRow({
      title: "Monster Train 2",
      slug: "monster-train-2",
      genres: ["Strategy", "Indie"],
      release_date: isoDaysAgo(320),
      review_count: 9252,
      steam_total_count: 9252,
      steam_positive_count: 8882,
      current_players: 679,
      momentum: 0,
      verdict_score: 94,
      score: 94,
      critic_score: 91,
      igdb_rating: 91,
      confidence: 0.91,
      trending: false,
    });

    expect(isHomepageHeroAutoCandidate(candidate)).toBe(false);
  });

  it("accepts a breakout-scale recent game with strong current player demand", () => {
    const breakout = makeGameRow({
      id: "00000000-0000-0000-0000-000000000200",
      slug: "massive-breakout",
      title: "Massive Breakout",
      release_date: isoDaysAgo(35),
      review_count: 18000,
      steam_total_count: 18000,
      steam_positive_count: 16740,
      current_players: 11200,
      momentum: 0.12,
      verdict_score: 88,
      score: 88,
      confidence: 0.8,
      trending: true,
    });

    expect(isHomepageHeroAutoCandidate(breakout)).toBe(true);
  });

  it("accepts a major critically-backed flagship and ranks a breakout above a mid-scale hit", () => {
    const criticBacked = makeGameRow({
      id: "00000000-0000-0000-0000-000000000201",
      slug: "prestige-release",
      title: "Prestige Release",
      release_date: isoDaysAgo(80),
      review_count: 9000,
      steam_total_count: 9000,
      steam_positive_count: 8100,
      current_players: 1200,
      momentum: 0.02,
      verdict_score: 90,
      score: 90,
      critic_score: 91,
      igdb_rating: 90,
      rawg_metacritic: 92,
      critic_source_count: 2,
      confidence: 0.74,
    });
    const breakout = makeGameRow({
      id: "00000000-0000-0000-0000-000000000202",
      slug: "massive-breakout-2",
      title: "Massive Breakout 2",
      release_date: isoDaysAgo(28),
      review_count: 22000,
      steam_total_count: 22000,
      steam_positive_count: 20460,
      current_players: 13800,
      momentum: 0.15,
      verdict_score: 89,
      score: 89,
      confidence: 0.82,
      trending: true,
    });
    const midScale = makeGameRow({
      id: "00000000-0000-0000-0000-000000000203",
      slug: "mid-scale-hit",
      title: "Mid Scale Hit",
      release_date: isoDaysAgo(140),
      review_count: 21000,
      steam_total_count: 21000,
      steam_positive_count: 19740,
      current_players: 1800,
      momentum: 0.02,
      verdict_score: 90,
      score: 90,
      confidence: 0.84,
      trending: true,
    });

    expect(isHomepageHeroAutoCandidate(criticBacked)).toBe(true);
    expect(getHomepageHeroScore(breakout)).toBeGreaterThan(getHomepageHeroScore(midScale));
  });
});
