import { describe, it, expect } from "vitest";
import { normalizePlatform, normalizePlatforms, CANONICAL_PLATFORMS } from "../platform";

describe("normalizePlatform", () => {
  it("returns null for empty string", () => {
    expect(normalizePlatform("")).toBeNull();
  });

  it("normalizes PC variants", () => {
    expect(normalizePlatform("PC")).toBe("PC");
    expect(normalizePlatform("pc")).toBe("PC");
    expect(normalizePlatform("PC (Microsoft Windows)")).toBe("PC");
    expect(normalizePlatform("Microsoft Windows")).toBe("PC");
    expect(normalizePlatform("windows")).toBe("PC");
    expect(normalizePlatform("win")).toBe("PC");
  });

  it("normalizes PlayStation variants", () => {
    expect(normalizePlatform("PlayStation 5")).toBe("PlayStation 5");
    expect(normalizePlatform("ps5")).toBe("PlayStation 5");
    expect(normalizePlatform("PS5")).toBe("PlayStation 5");
    expect(normalizePlatform("PlayStation 4")).toBe("PlayStation 4");
    expect(normalizePlatform("ps4")).toBe("PlayStation 4");
  });

  it("normalizes Xbox variants", () => {
    expect(normalizePlatform("Xbox Series X|S")).toBe("Xbox Series X|S");
    expect(normalizePlatform("Xbox Series X/S")).toBe("Xbox Series X|S");
    expect(normalizePlatform("Xbox Series X")).toBe("Xbox Series X|S");
    expect(normalizePlatform("xsx")).toBe("Xbox Series X|S");
    expect(normalizePlatform("Xbox One")).toBe("Xbox One");
    expect(normalizePlatform("xb1")).toBe("Xbox One");
  });

  it("normalizes Nintendo variants", () => {
    expect(normalizePlatform("Nintendo Switch")).toBe("Nintendo Switch");
    expect(normalizePlatform("switch")).toBe("Nintendo Switch");
    expect(normalizePlatform("nsw")).toBe("Nintendo Switch");
    expect(normalizePlatform("Nintendo Switch 2")).toBe("Nintendo Switch 2");
    expect(normalizePlatform("switch 2")).toBe("Nintendo Switch 2");
    expect(normalizePlatform("ns2")).toBe("Nintendo Switch 2");
  });

  it("normalizes mobile platforms", () => {
    expect(normalizePlatform("Android")).toBe("Android");
    expect(normalizePlatform("iOS")).toBe("iOS");
    expect(normalizePlatform("iphone")).toBe("iOS");
    expect(normalizePlatform("ipad")).toBe("iOS");
  });

  it("normalizes desktop platforms", () => {
    expect(normalizePlatform("macOS")).toBe("macOS");
    expect(normalizePlatform("mac")).toBe("macOS");
    expect(normalizePlatform("Apple Macintosh")).toBe("macOS");
    expect(normalizePlatform("Linux")).toBe("Linux");
    expect(normalizePlatform("lnx")).toBe("Linux");
  });

  it("returns null for unrecognized platforms", () => {
    expect(normalizePlatform("Commodore 64")).toBeNull();
    expect(normalizePlatform("Dreamcast")).toBeNull();
    expect(normalizePlatform("Atari")).toBeNull();
  });

  it("handles whitespace", () => {
    expect(normalizePlatform("  PC  ")).toBe("PC");
    expect(normalizePlatform("  ps5 ")).toBe("PlayStation 5");
  });
});

describe("normalizePlatforms", () => {
  it("returns empty array for empty input", () => {
    expect(normalizePlatforms([])).toEqual([]);
  });

  it("normalizes and deduplicates", () => {
    const result = normalizePlatforms(["PC", "pc", "windows", "PlayStation 5", "ps5"]);
    expect(result).toEqual(["PC", "PlayStation 5"]);
  });

  it("filters out unrecognized platforms", () => {
    const result = normalizePlatforms(["PC", "Dreamcast", "ps5", "Atari"]);
    expect(result).toEqual(["PC", "PlayStation 5"]);
  });

  it("preserves insertion order of first occurrence", () => {
    const result = normalizePlatforms(["ps5", "PC", "Xbox Series X"]);
    expect(result).toEqual(["PlayStation 5", "PC", "Xbox Series X|S"]);
  });
});

describe("CANONICAL_PLATFORMS", () => {
  it("contains all 11 expected platforms", () => {
    expect(CANONICAL_PLATFORMS).toHaveLength(11);
    expect(CANONICAL_PLATFORMS).toContain("PC");
    expect(CANONICAL_PLATFORMS).toContain("PlayStation 5");
    expect(CANONICAL_PLATFORMS).toContain("Nintendo Switch 2");
    expect(CANONICAL_PLATFORMS).toContain("iOS");
    expect(CANONICAL_PLATFORMS).toContain("macOS");
    expect(CANONICAL_PLATFORMS).toContain("Linux");
  });
});
