import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameRow } from "@/lib/supabase/types";
import { getCatalogueUpcomingTiming, rankCatalogueCohort } from "./catalogue-discovery-ranking";

function game(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "game",
    slug: "game",
    title: "Example Game",
    description: "Explore a sprawling world in this adventure game.",
    release_date: "2026-10-01",
    release_status: "released",
    cover_image: "https://images.igdb.com/example.jpg",
    genres: ["Adventure"],
    platforms: ["PC"],
    tags: [],
    developer: "Example Studio",
    created_at: "2026-10-02T00:00:00Z",
    steam_app_id: 12345,
    steam_total_count: 7500,
    review_count: 7500,
    score: 94,
    verdict_score: 94,
    confidence: 0.9,
    ...overrides,
  } as GameRow;
}

const observedNow = Date.parse("2026-11-26T12:00:00Z");

describe("catalogue ranking clock", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the snapshot date for Upcoming and Newest release eligibility", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2035-01-01T00:00:00Z"));
    const future = game({ release_date: "2026-12-01", release_status: null });
    const confirmed = game({ release_date: "2026-12-01" });

    expect(rankCatalogueCohort([future], { query: "", sort: "upcoming" }, false, observedNow)).toEqual([future]);
    expect(rankCatalogueCohort([confirmed], { query: "", sort: "newest" }, false, observedNow)).toEqual([]);
  });

  it("uses the snapshot date for player freshness and release age", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2035-01-01T00:00:00Z"));
    const recentlyActive = game({
      current_players: 1200,
      players_updated_at: "2026-11-26T10:00:00Z",
    });
    const stale = { ...recentlyActive, players_updated_at: "2026-11-25T10:00:00Z" };

    expect(rankCatalogueCohort([recentlyActive], { query: "", sort: "top-rated" }, false, observedNow))
      .toEqual([recentlyActive]);
    expect(rankCatalogueCohort([stale], { query: "", sort: "top-rated" }, false, observedNow)).toEqual([]);
    expect(rankCatalogueCohort([stale], { query: "", sort: "recently-added" }, false, observedNow)).toEqual([stale]);
  });

  it("uses the same clock to resolve canonical search representatives", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2035-01-01T00:00:00Z"));
    const older = game({ id: "older", release_date: "2023-10-01", verdict_score: 94 });
    const newer = game({ id: "newer", release_date: "2026-10-01", verdict_score: 84 });

    expect(rankCatalogueCohort([older, newer], { query: "Example Game", sort: "relevance" }, false, observedNow))
      .toEqual([newer]);
  });

  it("sorts release windows before unknown dates without turning placeholders into exact dates", () => {
    const period = game({ id: "window", title: "Year Window", steam_app_id: null, release_date: "2027-12-31", release_status: "upcoming" });
    const day = game({ id: "day", title: "Dated Release", steam_app_id: null, release_date: "2027-01-20", release_status: "upcoming" });
    const earlyAccess = game({ id: "early", title: "Early World", steam_app_id: null, release_date: "2026-01-20", release_status: "early-access" });
    const tba = game({ id: "tba", title: "Unknown Date", steam_app_id: null, release_date: "2027-01-10", release_status: "tba" });
    const cancelled = game({ id: "cancelled", title: "Cancelled Project", steam_app_id: null, release_date: "2027-01-20", release_status: "cancelled" });
    const rows = [earlyAccess, cancelled, day, tba, period];

    expect(rankCatalogueCohort(rows, { query: "", sort: "upcoming" }, false, observedNow))
      .toEqual([period, day, earlyAccess, tba]);
    expect(getCatalogueUpcomingTiming(period, new Date(observedNow))).toEqual({ precision: "year", value: "2027" });
    expect(getCatalogueUpcomingTiming(tba, new Date(observedNow))).toEqual({ precision: "tba" });
  });
});
