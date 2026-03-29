import { describe, it, expect } from "vitest";
import { isPublicSafeGame, filterPublicSafeGames, isPublicSafeRawgGame } from "../publicSafety";

describe("isPublicSafeGame", () => {
  it("blocks games with NSFW tag", () => {
    const game = { tags: ["action", "nsfw", "adventure"], genres: ["rpg"], description: "" };
    expect(isPublicSafeGame(game)).toBe(false);
  });

  it("blocks games with hentai tag", () => {
    const game = { tags: ["visual-novel", "hentai"], genres: [], description: "" };
    expect(isPublicSafeGame(game)).toBe(false);
  });

  it("blocks games with adult tag", () => {
    const game = { tags: ["adult"], genres: [], description: "" };
    expect(isPublicSafeGame(game)).toBe(false);
  });

  it("blocks games with sexual content tag", () => {
    const game = { tags: ["sexual content"], genres: [], description: "" };
    expect(isPublicSafeGame(game)).toBe(false);
  });

  it("blocks games with adult-related tag substrings", () => {
    const game = { tags: ["adult content"], genres: [], description: "" };
    expect(isPublicSafeGame(game)).toBe(false);
  });

  it("blocks games with adult description keywords", () => {
    const game = { tags: [], genres: [], description: "This game contains explicit sexual content and nudity." };
    expect(isPublicSafeGame(game)).toBe(false);
  });

  it("allows clean games", () => {
    const game = { tags: ["action", "adventure", "rpg"], genres: ["Role-Playing"], description: "An epic adventure awaits." };
    expect(isPublicSafeGame(game)).toBe(true);
  });

  it("allows games with null tags/genres", () => {
    const game = { tags: null, genres: null, description: null };
    expect(isPublicSafeGame(game)).toBe(true);
  });

  it("allows games with empty arrays", () => {
    const game = { tags: [], genres: [], description: "" };
    expect(isPublicSafeGame(game)).toBe(true);
  });

  it("is case-insensitive", () => {
    const game1 = { tags: ["NSFW"], genres: [], description: "" };
    const game2 = { tags: ["Hentai"], genres: [], description: "" };
    const game3 = { tags: ["ADULT"], genres: [], description: "" };
    expect(isPublicSafeGame(game1)).toBe(false);
    expect(isPublicSafeGame(game2)).toBe(false);
    expect(isPublicSafeGame(game3)).toBe(false);
  });

  it("checks genres as well as tags", () => {
    const game = { tags: ["action"], genres: ["adult"], description: "" };
    expect(isPublicSafeGame(game)).toBe(false);
  });
});

describe("filterPublicSafeGames", () => {
  it("filters out NSFW games from array", () => {
    const games = [
      { id: "1", tags: ["action"], genres: [], description: "" },
      { id: "2", tags: ["nsfw"], genres: [], description: "" },
      { id: "3", tags: ["rpg"], genres: [], description: "" },
      { id: "4", tags: ["hentai"], genres: [], description: "" },
    ];

    const safe = filterPublicSafeGames(games);
    expect(safe).toHaveLength(2);
    expect(safe.map((g) => g.id)).toEqual(["1", "3"]);
  });

  it("returns empty array for all-NSFW input", () => {
    const games = [
      { id: "1", tags: ["nsfw"], genres: [], description: "" },
      { id: "2", tags: ["adult"], genres: [], description: "" },
    ];

    const safe = filterPublicSafeGames(games);
    expect(safe).toHaveLength(0);
  });

  it("returns all games when all are safe", () => {
    const games = [
      { id: "1", tags: ["action"], genres: [], description: "" },
      { id: "2", tags: ["rpg"], genres: [], description: "" },
    ];

    const safe = filterPublicSafeGames(games);
    expect(safe).toHaveLength(2);
  });
});

describe("isPublicSafeRawgGame", () => {
  it("blocks RAWG games with NSFW tags", () => {
    const item = {
      tags: [{ name: "NSFW", slug: "nsfw" }],
      genres: [{ name: "Action", slug: "action" }],
    };
    expect(isPublicSafeRawgGame(item)).toBe(false);
  });

  it("blocks RAWG games with adult genres", () => {
    const item = {
      tags: [],
      genres: [{ name: "Adult", slug: "adult" }],
    };
    expect(isPublicSafeRawgGame(item)).toBe(false);
  });

  it("allows clean RAWG games", () => {
    const item = {
      tags: [{ name: "Adventure", slug: "adventure" }],
      genres: [{ name: "RPG", slug: "rpg" }],
    };
    expect(isPublicSafeRawgGame(item)).toBe(true);
  });

  it("handles null tags/genres", () => {
    const item = { tags: null, genres: null };
    expect(isPublicSafeRawgGame(item)).toBe(true);
  });
});
