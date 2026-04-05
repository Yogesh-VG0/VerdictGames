import { describe, expect, it } from "vitest";
import type { GameRow } from "../../supabase/types";
import {
  isHomepageRecommendationDistinctCandidate,
  isHomepageTrendingEligible,
  isHomepageTopRatedEligible,
  isHomepageTopRatedEvergreenBackfillCandidate,
} from "../../services/homepage";
import { getBrowseTopRatedScore, isBrowseTopRatedEligible } from "../../services/search";
import { filterQualityGames, getEvidenceReviewCount, isQualityGame } from "../quality";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function makeGameRow(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
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
    release_date: "2025-01-15",
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
    created_at: "2025-01-15T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
    ...overrides,
  };
}

describe("top-rated quality gates", () => {
  it("counts direct Steam review evidence at full weight", () => {
    const row = makeGameRow();

    expect(getEvidenceReviewCount(row)).toBe(1000);
    expect(isQualityGame(row, "topRated")).toBe(true);
  });

  it("rejects fallback-only RAWG counts without critic support", () => {
    const row = makeGameRow({
      review_count: 5000,
      user_score: null,
      steam_positive_count: null,
      steam_total_count: null,
      steam_url: null,
      steam_app_id: null,
      critic_score: null,
      critic_source_count: 0,
      rawg_metacritic: null,
      rawg_rating: 4.8,
      score_source: "rawg",
      confidence: 0.24,
      current_players: 0,
    });

    expect(getEvidenceReviewCount(row)).toBe(300);
    expect(isQualityGame(row, "topRated")).toBe(false);
  });

  it("allows strong critic-backed non-Steam games into top-rated", () => {
    const row = makeGameRow({
      review_count: 0,
      user_score: null,
      steam_positive_count: null,
      steam_total_count: null,
      steam_url: null,
      steam_app_id: null,
      critic_score: 90,
      critic_source_count: 2,
      igdb_rating: 89,
      rawg_metacritic: 91,
      rawg_rating: null,
      score_source: "igdb",
      confidence: 0.2,
      current_players: 0,
      verdict_score: 89,
    });

    expect(isQualityGame(row, "topRated")).toBe(true);
  });

  it("keeps a high-quality niche game out of homepage top-rated when live presence is too low", () => {
    const row = makeGameRow({
      title: "Monster Train 2",
      slug: "monster-train-2",
      release_date: isoDaysAgo(320),
      review_count: 9252,
      steam_total_count: 9252,
      steam_positive_count: 8882,
      current_players: 679,
      critic_score: 91,
      critic_source_count: 2,
      igdb_rating: 91,
      rawg_metacritic: 91,
      verdict_score: 94,
      score: 94,
      confidence: 0.91,
    });

    expect(isQualityGame(row, "topRated")).toBe(true);
    expect(isHomepageTopRatedEligible(row)).toBe(false);
  });

  it("keeps slower-burn one-year-old hits out of homepage top-rated when live presence slips too low", () => {
    const row = makeGameRow({
      title: "Two Point Museum",
      slug: "two-point-museum",
      release_date: isoDaysAgo(396),
      review_count: 11352,
      steam_total_count: 11352,
      steam_positive_count: 10784,
      current_players: 785,
      critic_score: 90,
      critic_source_count: 2,
      igdb_rating: 90,
      rawg_metacritic: 90,
      verdict_score: 93,
      score: 93,
      confidence: 0.94,
    });

    expect(isQualityGame(row, "topRated")).toBe(true);
    expect(isHomepageTopRatedEligible(row)).toBe(false);
  });

  it("keeps critic-backed micro-activity games out of homepage top-rated even when reviews are excellent", () => {
    const row = makeGameRow({
      title: "TR-49",
      slug: "tr-49",
      release_date: isoDaysAgo(73),
      review_count: 823,
      steam_total_count: 823,
      steam_positive_count: 790,
      current_players: 7,
      critic_score: 88,
      critic_source_count: 1,
      igdb_rating: 88,
      rawg_metacritic: null,
      verdict_score: 92,
      score: 92,
      confidence: 0.93,
    });

    expect(isQualityGame(row, "topRated")).toBe(true);
    expect(isHomepageTopRatedEligible(row)).toBe(false);
  });

  it("keeps low-activity older classics out of browse top-rated eligibility when live presence is too weak", () => {
    const row = makeGameRow({
      title: "The Henry Stickmin Collection",
      slug: "the-henry-stickmin-collection",
      release_date: isoDaysAgo(1940),
      review_count: 55986,
      steam_total_count: 55986,
      steam_positive_count: 54732,
      current_players: 107,
      critic_score: null,
      critic_source_count: 0,
      igdb_rating: null,
      rawg_metacritic: null,
      verdict_score: 98,
      score: 98,
      confidence: 0.93,
    });

    expect(isQualityGame(row, "topRated")).toBe(true);
    expect(isBrowseTopRatedEligible(row)).toBe(false);
  });

  it("keeps recent critical darlings out of top-rated surfaces when current live activity is too weak", () => {
    const row = makeGameRow({
      title: "Rhythm Doctor",
      slug: "rhythm-doctor",
      release_date: isoDaysAgo(118),
      review_count: 25924,
      steam_total_count: 25924,
      steam_positive_count: 25406,
      current_players: 121,
      critic_score: 93,
      critic_source_count: 1,
      igdb_rating: 93,
      rawg_metacritic: 93,
      verdict_score: 96,
      score: 96,
      confidence: 0.95,
    });

    expect(isQualityGame(row, "topRated")).toBe(true);
    expect(isHomepageTopRatedEligible(row)).toBe(false);
    expect(isBrowseTopRatedEligible(row)).toBe(false);
  });

  it("allows elite evergreen hits to backfill homepage top-rated when they still have strong live presence", () => {
    const row = makeGameRow({
      title: "Factorio",
      slug: "factorio",
      release_date: isoDaysAgo(365 * 6),
      review_count: 168420,
      steam_total_count: 168420,
      steam_positive_count: 164500,
      current_players: 18400,
      critic_score: 90,
      critic_source_count: 1,
      igdb_rating: 90,
      rawg_metacritic: 90,
      verdict_score: 95,
      score: 95,
      confidence: 0.97,
    });

    expect(isHomepageTopRatedEligible(row)).toBe(true);
    expect(isHomepageTopRatedEvergreenBackfillCandidate(row)).toBe(true);
  });

  it("keeps older mid-scale hits out of evergreen homepage top-rated backfill when their live presence is no longer elite", () => {
    const row = makeGameRow({
      title: "Two Point Museum",
      slug: "two-point-museum",
      release_date: isoDaysAgo(396),
      review_count: 11352,
      steam_total_count: 11352,
      steam_positive_count: 10784,
      current_players: 785,
      critic_score: 90,
      critic_source_count: 2,
      igdb_rating: 90,
      rawg_metacritic: 90,
      verdict_score: 93,
      score: 93,
      confidence: 0.94,
    });

    expect(isHomepageTopRatedEvergreenBackfillCandidate(row)).toBe(false);
  });

  it("allows high-quality discovery picks into homepage recommendations when they are distinct from hero, trending, and top-rated", () => {
    const row = makeGameRow({
      title: "Citizen Sleeper 2",
      slug: "citizen-sleeper-2",
      release_date: isoDaysAgo(90),
      review_count: 4200,
      steam_total_count: 4200,
      steam_positive_count: 4010,
      current_players: 180,
      critic_score: 90,
      critic_source_count: 2,
      igdb_rating: 90,
      rawg_metacritic: 89,
      verdict_score: 91,
      score: 91,
      confidence: 0.9,
      momentum: 0.02,
      header_image: "",
    });

    expect(isHomepageTopRatedEligible(row)).toBe(false);
    expect(isHomepageRecommendationDistinctCandidate(row)).toBe(true);
  });

  it("keeps obvious hero or top-rated style blockbusters out of homepage recommendation distinct picks", () => {
    const row = makeGameRow({
      title: "Black Myth: Wukong",
      slug: "black-myth-wukong",
      release_date: isoDaysAgo(120),
      review_count: 510245,
      steam_total_count: 510245,
      steam_positive_count: 487000,
      current_players: 31200,
      critic_score: 88,
      critic_source_count: 2,
      igdb_rating: 88,
      rawg_metacritic: 88,
      verdict_score: 94,
      score: 94,
      confidence: 0.97,
      momentum: 0.09,
    });

    expect(isHomepageTopRatedEligible(row)).toBe(true);
    expect(isHomepageRecommendationDistinctCandidate(row)).toBe(false);
  });

  it("ranks broadly popular modern hits ahead of older lower-activity classics in browse top-rated", () => {
    const modern = makeGameRow({
      title: "Baldur's Gate III",
      slug: "baldurs-gate-iii",
      release_date: isoDaysAgo(970),
      review_count: 827269,
      steam_total_count: 827269,
      steam_positive_count: 792000,
      current_players: 37315,
      verdict_score: 96,
      score: 96,
      confidence: 0.98,
    });
    const classic = makeGameRow({
      title: "Half-Life: Alyx",
      slug: "half-life-alyx",
      release_date: isoDaysAgo(2200),
      review_count: 102667,
      steam_total_count: 102667,
      steam_positive_count: 101000,
      current_players: 1600,
      verdict_score: 96,
      score: 96,
      confidence: 0.97,
    });

    expect(isBrowseTopRatedEligible(modern)).toBe(true);
    expect(isBrowseTopRatedEligible(classic)).toBe(true);
    expect(getBrowseTopRatedScore(modern)).toBeGreaterThan(getBrowseTopRatedScore(classic));
  });
});

describe("new release quality gates", () => {
  it("rejects low-signal launches with modest reviews but negligible live players", () => {
    const row = makeGameRow({
      title: "DAMON and BABY",
      slug: "damon-and-baby",
      release_date: isoDaysAgo(9),
      review_count: 50,
      steam_total_count: 50,
      steam_positive_count: 41,
      current_players: 15,
      verdict_score: 76,
      score: 76,
      confidence: 0.62,
    });

    expect(isQualityGame(row, "newReleases")).toBe(false);
  });

  it("rejects tiny-activity launches even when their early score looks strong", () => {
    const row = makeGameRow({
      title: "Bubblegum Galaxy",
      slug: "bubblegum-galaxy",
      release_date: isoDaysAgo(12),
      review_count: 91,
      steam_total_count: 91,
      steam_positive_count: 88,
      current_players: 1,
      verdict_score: 93,
      score: 93,
      confidence: 0.88,
    });

    expect(isQualityGame(row, "newReleases")).toBe(false);
  });

  it("allows strong review-backed releases with limited current players when evidence scale is substantial", () => {
    const row = makeGameRow({
      title: "Legacy of Kain: Defiance Remastered",
      slug: "legacy-of-kain-defiance-remastered",
      release_date: isoDaysAgo(32),
      review_count: 439,
      steam_total_count: 439,
      steam_positive_count: 421,
      current_players: 52,
      verdict_score: 94,
      score: 94,
      confidence: 0.9,
    });

    expect(isQualityGame(row, "newReleases")).toBe(true);
  });

  it("rejects fallback-only new releases that lack both live demand and strong critic support", () => {
    const row = makeGameRow({
      title: "Fallback Hype",
      slug: "fallback-hype",
      release_date: isoDaysAgo(6),
      review_count: 5000,
      user_score: null,
      steam_positive_count: null,
      steam_total_count: null,
      steam_url: null,
      steam_app_id: null,
      rawg_rating: 4.8,
      current_players: 0,
      critic_score: null,
      critic_source_count: 0,
      rawg_metacritic: null,
      score_source: "rawg",
      verdict_score: 90,
      score: 90,
      confidence: 0.45,
    });

    expect(getEvidenceReviewCount(row)).toBe(300);
    expect(isQualityGame(row, "newReleases")).toBe(false);
  });

  it("falls back to readiness-filtered new releases when the strict quality pool is too thin", () => {
    const lowSignalButReady = makeGameRow({
      title: "Quiet Launch",
      slug: "quiet-launch",
      release_date: isoDaysAgo(10),
      review_count: 30,
      steam_total_count: 30,
      steam_positive_count: 24,
      current_players: 12,
      verdict_score: 74,
      score: 74,
      confidence: 0.45,
    });

    expect(isQualityGame(lowSignalButReady, "newReleases")).toBe(false);
    expect(
      filterQualityGames([lowSignalButReady], {
        section: "newReleases",
        minResults: 20,
        allowReadinessFallback: true,
        fallbackSurface: "homepageRail",
      })
    ).toEqual([lowSignalButReady]);
  });
});

describe("homepage trending freshness gates", () => {
  it("keeps older high-activity evergreen games out of homepage trending when they are too stale for the homepage rail", () => {
    const staleCarryover = makeGameRow({
      title: "Farming Simulator 22",
      slug: "farming-simulator-22",
      release_date: isoDaysAgo(365 * 4 + 150),
      trending: true,
      review_count: 90000,
      steam_total_count: 90000,
      steam_positive_count: 81000,
      current_players: 9350,
      momentum: 0.219,
      verdict_score: 86,
      score: 86,
      confidence: 0.93,
    });

    expect(isHomepageTrendingEligible(staleCarryover)).toBe(false);
  });

  it("still allows fresher breakout-scale games into homepage trending", () => {
    const freshBreakout = makeGameRow({
      title: "Abiotic Factor",
      slug: "abiotic-factor",
      release_date: isoDaysAgo(260),
      trending: true,
      review_count: 52000,
      steam_total_count: 52000,
      steam_positive_count: 49400,
      current_players: 3900,
      momentum: 0.42,
      verdict_score: 95,
      score: 95,
      confidence: 0.96,
    });

    expect(isHomepageTrendingEligible(freshBreakout)).toBe(true);
  });
});
