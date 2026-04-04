import { describe, expect, it } from "vitest";
import type { Game, GXCalendarGame } from "@/lib/types";
import { dedupeGXCalendarGames, mergeCalendarGames } from "../gx-calendar";

function createGame(overrides: Partial<Game> = {}): Game {
  return {
    id: overrides.id ?? "game-1",
    slug: overrides.slug ?? "game-1",
    title: overrides.title ?? "Game 1",
    coverImage: overrides.coverImage ?? "https://example.com/cover.jpg",
    headerImage: overrides.headerImage ?? "https://example.com/header.jpg",
    screenshots: overrides.screenshots ?? [],
    platforms: overrides.platforms ?? ["PC"],
    genres: overrides.genres ?? ["Action"],
    tags: overrides.tags ?? [],
    developer: overrides.developer ?? "",
    publisher: overrides.publisher ?? "",
    releaseDate: overrides.releaseDate ?? "2026-04-16",
    description: overrides.description ?? "A detailed game description that is long enough to be considered usable.",
    score: overrides.score ?? 0,
    verdictLabel: overrides.verdictLabel ?? "COMING SOON",
    verdictSummary: overrides.verdictSummary ?? "",
    pros: overrides.pros ?? [],
    cons: overrides.cons ?? [],
    monetization: overrides.monetization ?? "Paid",
    performanceNotes: overrides.performanceNotes ?? "",
    monetizationNotes: overrides.monetizationNotes ?? "",
    reviewCount: overrides.reviewCount ?? 0,
    ...overrides,
  };
}

function createGXCalendarGame(overrides: Partial<GXCalendarGame> = {}): GXCalendarGame {
  return {
    title: overrides.title ?? "Game 1",
    slug: overrides.slug ?? "game-1",
    cover: overrides.cover ?? "https://example.com/gx-cover.jpg",
    releaseDate: overrides.releaseDate ?? "2026-04-16",
    originalReleaseDate: overrides.originalReleaseDate ?? "2026-04-16",
    hotGame: overrides.hotGame ?? false,
    url: overrides.url ?? null,
    ctaLabel: overrides.ctaLabel ?? null,
    tagLabel: overrides.tagLabel ?? null,
    tagColor: overrides.tagColor ?? null,
    genres: overrides.genres ?? ["Action"],
    platforms: overrides.platforms ?? ["PC"],
    ...overrides,
  };
}

describe("dedupeGXCalendarGames", () => {
  it("merges confusable short-title and subtitle variants into a single fuller entry", () => {
    const items = dedupeGXCalendarGames([
      createGXCalendarGame({
        title: "MОUSE",
        slug: "muse",
        releaseDate: "2026-04-16",
        platforms: ["PC"],
      }),
      createGXCalendarGame({
        title: "Mouse: P.I. For Hire",
        slug: "mouse-pi-for-hire",
        releaseDate: "2026-04-16",
        platforms: ["PC", "PlayStation 5", "Xbox Series X|S"],
        genres: ["Action", "Shooter"],
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Mouse: P.I. For Hire");
    expect(items[0]?.slug).toBe("mouse-pi-for-hire");
    expect(items[0]?.platforms).toEqual(["PC", "PlayStation 5", "Xbox Series X|S"]);
  });
});

describe("mergeCalendarGames", () => {
  it("filters promo demo rows from the final merged calendar output", () => {
    const merged = mergeCalendarGames([
      createGame({
        id: "promo-1",
        slug: "gta-6-demo",
        title: "GTA 6 Demo",
        releaseDate: "2026-04-01",
      }),
      createGame({
        id: "real-1",
        slug: "grime-ii",
        title: "Grime II",
        releaseDate: "2026-04-01",
        verdictLabel: "WORTH IT",
        reviewCount: 100,
      }),
    ], []);

    expect(merged.map((game) => game.slug)).toEqual(["grime-ii"]);
  });

  it("prefers the stronger canonical db representative when matching gx context", () => {
    const merged = mergeCalendarGames(
      [
        createGame({
          id: "short-1",
          slug: "muse",
          title: "MОUSE",
          releaseDate: "2026-04-16",
          description: "",
          coverImage: "https://example.com/short-cover.jpg",
          headerImage: "https://example.com/short-header.jpg",
          platforms: ["PC"],
          genres: ["Action"],
          reviewCount: 6,
          confidence: 0.2,
        }),
        createGame({
          id: "full-1",
          slug: "mouse-pi-for-hire",
          title: "MOUSE: P.I. For Hire",
          releaseDate: "2026-04-16",
          description: "Join private investigator Jack Pepper on a guns blazing adventure through a noir city.",
          coverImage: "https://example.com/full-cover.jpg",
          headerImage: "https://example.com/full-header.jpg",
          platforms: ["PC", "PlayStation 5", "Xbox Series X|S", "Nintendo Switch"],
          genres: ["Action", "Indie"],
          publisher: "PlaySide",
          reviewCount: 50,
          confidence: 0.5,
        }),
      ],
      [
        createGXCalendarGame({
          title: "MОUSE",
          slug: "muse",
          releaseDate: "2026-04-16",
          platforms: ["PC"],
        }),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.slug).toBe("mouse-pi-for-hire");
    expect(merged[0]?.title).toBe("MOUSE: P.I. For Hire");
    expect(merged[0]?.calendarHasDetailPage).toBe(true);
  });
});
