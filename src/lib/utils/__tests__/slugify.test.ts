import { describe, it, expect } from "vitest";
import { slugify, normalizeTitle, titlesMatch } from "../slugify";

describe("slugify", () => {
  it("converts basic strings to slugs", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Grand Theft Auto V")).toBe("grand-theft-auto-v");
  });

  it("handles ampersands", () => {
    expect(slugify("Ratchet & Clank")).toBe("ratchet-and-clank");
  });

  it("strips special characters", () => {
    expect(slugify("Assassin's Creed: Valhalla")).toBe("assassins-creed-valhalla");
    expect(slugify("DOOM (2016)")).toBe("doom-2016");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("Game -- The Sequel")).toBe("game-the-sequel");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Game-  ")).toBe("game");
  });

  it("handles empty and whitespace-only input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("handles numbered titles", () => {
    expect(slugify("Final Fantasy 16")).toBe("final-fantasy-16");
    expect(slugify("Resident Evil 4")).toBe("resident-evil-4");
  });
});

describe("normalizeTitle", () => {
  it("strips non-alphanumeric characters", () => {
    expect(normalizeTitle("Grand Theft Auto V")).toBe("grandtheftautov");
    expect(normalizeTitle("Assassin's Creed")).toBe("assassinscreed");
  });

  it("lowercases everything", () => {
    expect(normalizeTitle("DOOM")).toBe("doom");
  });
});

describe("titlesMatch", () => {
  it("matches identical titles", () => {
    expect(titlesMatch("Hades", "Hades")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(titlesMatch("HADES", "hades")).toBe(true);
  });

  it("matches ignoring special characters", () => {
    expect(titlesMatch("Assassin's Creed", "Assassins Creed")).toBe(true);
    expect(titlesMatch("Tom Clancy's: Splinter Cell", "Tom Clancys Splinter Cell")).toBe(true);
  });

  it("does not match different titles", () => {
    expect(titlesMatch("Hades", "Hades II")).toBe(false);
    expect(titlesMatch("GTA V", "GTA VI")).toBe(false);
  });
});
