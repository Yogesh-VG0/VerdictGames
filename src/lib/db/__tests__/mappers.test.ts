import { describe, it, expect } from "vitest";
import { mapGameRow, mapReviewRow } from "../mappers";
import type { GameRow, ReviewRow } from "../../supabase/types";

/** Minimal valid GameRow for testing. Override fields as needed. */
function makeGameRow(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "test-game",
    title: "Test Game",
    subtitle: null,
    cover_image: "https://example.com/cover.jpg",
    header_image: "https://example.com/header.jpg",
    screenshots: [],
    platforms: ["PC", "ps5"],
    genres: ["Action"],
    tags: ["Singleplayer"],
    developer: "Test Dev",
    publisher: "Test Pub",
    release_date: "2024-01-15",
    description: "A test game.",
    score: 85,
    verdict_label: "WORTH IT",
    verdict_summary: "Solid game.",
    pros: ["Great gameplay"],
    cons: ["Short"],
    review_count: 100,
    user_score: 82,
    steam_positive_count: 82,
    steam_total_count: 100,
    community_score: 80,
    critic_score: 84,
    critic_source_count: 1,
    confidence: 0.82,
    verdict_score: 83,
    monetization: "Paid",
    performance_notes: "",
    monetization_notes: "",
    steam_url: "https://store.steampowered.com/app/12345",
    play_store_url: null,
    featured: false,
    trending: true,
    rawg_id: 12345,
    steam_app_id: 12345,
    price_current: 2999,
    price_currency: "USD",
    price_lowest: 1499,
    price_deal_url: null,
    is_free: false,
    current_players: 5000,
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
    rawg_metacritic: 85,
    rawg_rating: 4.2,
    score_source: "steam",
    last_enriched_at: new Date().toISOString(),
    enrichment_sources: ["rawg", "steam"],
    hltb_main: 12.5,
    hltb_extras: 20.0,
    hltb_completionist: 35.0,
    hltb_last_fetched: null,
    franchise: null,
    momentum: 0.15,
    is_featured_manual: false,
    is_trending_manual: false,
    manual_score: null,
    is_provisional: false,
    release_status: null,
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
    ...overrides,
  };
}

describe("mapGameRow", () => {
  it("maps basic fields correctly", () => {
    const row = makeGameRow();
    const game = mapGameRow(row);

    expect(game.id).toBe(row.id);
    expect(game.slug).toBe("test-game");
    expect(game.title).toBe("Test Game");
    expect(game.developer).toBe("Test Dev");
    expect(game.publisher).toBe("Test Pub");
    expect(game.coverImage).toBe(row.cover_image);
    expect(game.headerImage).toBe(row.header_image);
  });

  it("normalizes platforms from raw values", () => {
    const row = makeGameRow();
    row.platforms = ["PC", "ps5", "Xbox Series X", "mac"];
    const game = mapGameRow(row);

    expect(game.platforms).toEqual(["PC", "PlayStation 5", "Xbox Series X|S", "macOS"]);
  });

  it("deduplicates platforms", () => {
    const row = makeGameRow();
    row.platforms = ["PC", "pc", "windows"];
    const game = mapGameRow(row);

    expect(game.platforms).toEqual(["PC"]);
  });

  it("computes verdict from score using Bayesian smoothing", () => {
    // With 100 reviews and score 85 -> Bayesian adjusts toward prior (80)
    const row = makeGameRow({ score: 85, review_count: 100 });
    const game = mapGameRow(row);
    expect(game.score).toBeGreaterThan(0);
    expect(["MUST PLAY", "WORTH IT", "MIXED", "SKIP"]).toContain(game.verdictLabel);
  });

  it("handles provisional/COMING SOON games", () => {
    const row = makeGameRow({
      score: 0,
      verdict_label: "COMING SOON",
    });
    // Force is_provisional via Object.assign since mapper reads it via type assertion
    (row as Record<string, unknown>).is_provisional = true;
    const game = mapGameRow(row);

    expect(game.isProvisional).toBe(true);
    expect(game.verdictLabel).toBe("COMING SOON");
    expect(game.score).toBe(0);
  });

  it("treats COMING SOON verdict_label as provisional even without flag", () => {
    const row = makeGameRow();
    row.score = 0;
    row.verdict_label = "COMING SOON";
    // Ensure is_provisional is false on the row itself
    row.is_provisional = false;
    const game = mapGameRow(row);

    // The COMING SOON label should trigger provisional treatment
    expect(game.isProvisional).toBe(true);
    expect(game.verdictLabel).toBe("COMING SOON");
  });

  it("maps multi-source fields", () => {
    const row = makeGameRow({
      price_current: 2999,
      price_lowest: 1499,
      current_players: 5000,
      steam_rating_label: "Very Positive",
      hltb_main: 12.5,
    });
    const game = mapGameRow(row);

    expect(game.priceCurrent).toBe(2999);
    expect(game.priceLowest).toBe(1499);
    expect(game.currentPlayers).toBe(5000);
    expect(game.steamRatingLabel).toBe("Very Positive");
    expect(game.hltbMain).toBe(12.5);
  });

  it("converts nulls to undefined for optional fields", () => {
    const row = makeGameRow();
    // Explicitly set these to null (overriding defaults)
    row.steam_url = null;
    row.trailer_url = null;
    row.igdb_rating = null;
    row.wikipedia_url = null;
    const game = mapGameRow(row);

    expect(game.steamUrl).toBeUndefined();
    expect(game.trailerUrl).toBeUndefined();
    expect(game.igdbRating).toBeUndefined();
    expect(game.wikipediaUrl).toBeUndefined();
  });
});

describe("mapReviewRow", () => {
  it("maps review with joined game and profile data", () => {
    const row: ReviewRow & {
      game?: { slug: string; title: string; cover_image: string } | null;
      profile?: { username: string; avatar_url: string } | null;
    } = {
      id: "review-001",
      game_id: "game-001",
      profile_id: "profile-001",
      rating: 85,
      title: "Great game!",
      body: "Really enjoyed it.",
      pros: ["Fun", "Beautiful"],
      cons: ["Short"],
      platform: "PC",
      helpful: 10,
      created_at: "2024-01-15T00:00:00Z",
      updated_at: "2024-01-15T00:00:00Z",
      game: { slug: "hades", title: "Hades", cover_image: "https://example.com/hades.jpg" },
      profile: { username: "testuser", avatar_url: "https://example.com/avatar.jpg" },
    };

    const review = mapReviewRow(row);

    expect(review.id).toBe("review-001");
    expect(review.gameSlug).toBe("hades");
    expect(review.gameTitle).toBe("Hades");
    expect(review.username).toBe("testuser");
    expect(review.rating).toBe(85);
    expect(review.pros).toEqual(["Fun", "Beautiful"]);
    expect(review.cons).toEqual(["Short"]);
    expect(review.helpful).toBe(10);
    expect(review.platform).toBe("PC");
  });

  it("handles missing joined data gracefully", () => {
    const row: ReviewRow & {
      game?: { slug: string; title: string; cover_image: string } | null;
      profile?: { username: string; avatar_url: string } | null;
    } = {
      id: "review-002",
      game_id: "game-002",
      profile_id: "profile-002",
      rating: 60,
      title: "",
      body: "Meh.",
      pros: [],
      cons: [],
      platform: "PlayStation 5",
      helpful: 0,
      created_at: "2024-01-16T00:00:00Z",
      updated_at: "2024-01-16T00:00:00Z",
      game: null,
      profile: null,
    };

    const review = mapReviewRow(row);

    expect(review.gameSlug).toBe("");
    expect(review.gameTitle).toBe("");
    expect(review.username).toBe("");
    expect(review.pros).toBeUndefined();
    expect(review.cons).toBeUndefined();
  });
});
