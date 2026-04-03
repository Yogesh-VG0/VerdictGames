import { describe, expect, it } from "vitest";
import { sanitizeDiscoveryDescription } from "../discovery";

describe("sanitizeDiscoveryDescription", () => {
  it("accepts fallback descriptions when sequel numerals differ only by Roman vs Arabic notation", () => {
    const description = sanitizeDiscoveryDescription({
      title: "Baldur's Gate III",
      description: "",
      igdb_summary: "",
      wikipedia_excerpt: "Baldur's Gate 3 is a 2023 role-playing video game developed and published by Larian Studios.",
    });

    expect(description).toContain("Baldur's Gate 3 is");
  });

  it("rejects fallback descriptions that clearly describe a different game", () => {
    const description = sanitizeDiscoveryDescription({
      title: "Vampire Crawlers",
      description: "",
      igdb_summary: "",
      wikipedia_excerpt: "Vampire Survivors is a roguelike shoot 'em up video game developed and published by Luca Galante.",
    });

    expect(description).toBe("");
  });
});
