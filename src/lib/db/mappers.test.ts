/**
 * Regression tests for mapGameRow and related scoring/formatting logic.
 * Covers the exact failure modes found during the March 2026 audit.
 */

import { describe, it, expect } from "vitest";
import { mapGameRow } from "./mappers";
import type { GameRow } from "../supabase/types";

/** Minimal valid GameRow factory for testing */
function makeGameRow(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "test-id",
    slug: "test-game",
    title: "Test Game",
    subtitle: null,
    cover_image: "https://example.com/cover.jpg",
    header_image: "https://example.com/header.jpg",
    screenshots: [],
    platforms: ["PC"],
    genres: ["Action"],
    tags: [],
    developer: "Test Dev",
    publisher: "Test Pub",
    release_date: "2025-01-01",
    description: "A test game.",
    score: 85,
    verdict_label: "WORTH IT",
    verdict_summary: "Test summary",
    pros: ["Good gameplay"],
    cons: ["Short"],
    monetization: "Paid",
    performance_notes: "",
    monetization_notes: "",
    steam_url: null,
    play_store_url: null,
    review_count: 5000,
    user_score: 85,
    featured: false,
    trending: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    rawg_id: 1,
    steam_app_id: 12345,
    price_current: null,
    price_currency: "USD",
    price_lowest: null,
    price_deal_url: null,
    is_free: false,
    current_players: null,
    peak_players_24h: null,
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
    steam_rating_label: null,
    rawg_metacritic: null,
    rawg_rating: null,
    score_source: "steam",
    hltb_main: null,
    hltb_extras: null,
    hltb_completionist: null,
    hltb_last_fetched: null,
    last_enriched_at: null,
    enrichment_sources: [],
    momentum: 0,
    players_updated_at: null,
    ...overrides,
  } as GameRow;
}

describe("mapGameRow", () => {
  // ── Confidence-weighted scoring ──

  it("a 2-review 100% game must not outrank a 50K-review 95% game", () => {
    const tinyReview = mapGameRow(makeGameRow({ score: 100, review_count: 2 }));
    const massiveReview = mapGameRow(makeGameRow({ score: 95, review_count: 50000 }));
    // The massive-review game should have a higher display score due to Bayesian smoothing
    expect(massiveReview.score).toBeGreaterThan(tinyReview.score);
  });

  it("Bayesian smoothing pulls tiny-sample scores toward prior", () => {
    const game = mapGameRow(makeGameRow({ score: 100, review_count: 4 }));
    // With 4 reviews and Bayesian prior of 75 with weight 50:
    // (100*4 + 75*50) / (4+50) = (400 + 3750) / 54 ≈ 77
    expect(game.score).toBeLessThan(80);
    expect(game.score).toBeGreaterThan(70);
  });

  it("games with 50+ reviews use raw score without smoothing", () => {
    const game = mapGameRow(makeGameRow({ score: 92, review_count: 100 }));
    expect(game.score).toBe(92);
  });

  // ── Future release mapping ──

  it("future-dated game always maps to COMING SOON", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const game = mapGameRow(makeGameRow({
      release_date: futureDate.toISOString().slice(0, 10),
      score: 85,
      review_count: 0,
    }));
    expect(game.verdictLabel).toBe("COMING SOON");
    expect(game.score).toBe(0);
  });

  it("future-dated game never gets WORTH IT or MUST PLAY", () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    const game = mapGameRow(makeGameRow({
      release_date: futureDate.toISOString().slice(0, 10),
      score: 95,
      review_count: 0,
      verdict_label: "MUST PLAY",
    }));
    expect(game.verdictLabel).toBe("COMING SOON");
    expect(game.verdictLabel).not.toBe("MUST PLAY");
    expect(game.verdictLabel).not.toBe("WORTH IT");
  });

  // ── 0-review games ──

  it("games with 0 reviews map to COMING SOON regardless of score", () => {
    const game = mapGameRow(makeGameRow({
      score: 80,
      review_count: 0,
      release_date: "2025-06-01",
    }));
    expect(game.verdictLabel).toBe("COMING SOON");
    expect(game.score).toBe(0);
  });

  // ── Verdict summary consistency ──

  it("verdict summary matches display score tier, not raw ingest score", () => {
    // A game with raw 100 score but only 4 reviews gets Bayesian-smoothed to ~77
    const game = mapGameRow(makeGameRow({
      title: "Duck the Miner",
      score: 100,
      review_count: 4,
      genres: ["Adventure", "Indie"],
      verdict_summary: "Duck the Miner is an exceptional Adventure/Indie experience that sets a new standard.",
    }));
    // Score should be smoothed to ~77 (WORTH IT tier), not 100 (MUST PLAY tier)
    expect(game.score).toBeLessThan(80);
    // Summary should NOT say "exceptional" for a 77-score game
    expect(game.verdictSummary).not.toContain("exceptional");
    expect(game.verdictSummary).not.toContain("masterclass");
  });

  it("high-score game with many reviews gets appropriate 'exceptional' summary", () => {
    const game = mapGameRow(makeGameRow({
      title: "Baldurs Gate III",
      score: 97,
      review_count: 800000,
      genres: ["Adventure", "RPG"],
    }));
    expect(game.score).toBe(97);
    // Should be in the >=90 tier
    expect(
      game.verdictSummary.includes("exceptional") ||
      game.verdictSummary.includes("masterclass") ||
      game.verdictSummary.includes("best") ||
      game.verdictSummary.includes("must-play")
    ).toBe(true);
  });

  // ── Review count formatting (sanitizePros) ──

  it("fixes legacy '0K reviews' text in pros", () => {
    const game = mapGameRow(makeGameRow({
      review_count: 91,
      pros: ["Overwhelmingly Positive on Steam (100% positive from 0K reviews)"],
    }));
    expect(game.pros[0]).not.toContain("0K reviews");
    expect(game.pros[0]).toContain("91 reviews");
  });

  it("formats review counts correctly for various magnitudes", () => {
    // <1000 → plain number
    const small = mapGameRow(makeGameRow({
      review_count: 4,
      pros: ["Very Positive on Steam (100% positive from 0K reviews)"],
    }));
    // 4-review game is provisional (0 reviews mapped to COMING SOON), but pros are still sanitized
    expect(small.pros[0]).toContain("4 reviews");

    // >=1000 <10000 → X.XK
    const medium = mapGameRow(makeGameRow({
      review_count: 5341,
      pros: ["Overwhelmingly Positive on Steam (99% positive from 0K reviews)"],
    }));
    expect(medium.pros[0]).toContain("5.3K reviews");

    // >=10000 → XK
    const large = mapGameRow(makeGameRow({
      review_count: 185015,
      pros: ["Overwhelmingly Positive on Steam (98% positive from 0K reviews)"],
    }));
    expect(large.pros[0]).toContain("185K reviews");
  });

  // ── Provisional state ──

  it("is_provisional flag forces COMING SOON", () => {
    const game = mapGameRow(makeGameRow({
      score: 90,
      review_count: 1000,
      is_provisional: true,
    } as Partial<GameRow>));
    expect(game.verdictLabel).toBe("COMING SOON");
    expect(game.score).toBe(0);
  });
});
