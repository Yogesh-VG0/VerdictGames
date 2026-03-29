import { describe, it, expect } from "vitest";
import { hasUsableCardImage, isSteamLibraryCover } from "../mediaReadiness";

describe("hasUsableCardImage", () => {
  it("rejects empty cover", () => {
    const row = { cover_image: "", header_image: "" };
    expect(hasUsableCardImage(row)).toBe(false);
  });

  it("rejects null cover", () => {
    const row = { cover_image: null, header_image: null };
    expect(hasUsableCardImage(row)).toBe(false);
  });

  it("rejects undefined cover", () => {
    const row = { cover_image: undefined, header_image: undefined };
    expect(hasUsableCardImage(row)).toBe(false);
  });

  it("accepts valid RAWG cover", () => {
    const row = {
      cover_image: "https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060c14e96612001.jpg",
      header_image: "",
    };
    expect(hasUsableCardImage(row)).toBe(true);
  });

  it("accepts valid IGDB cover", () => {
    const row = {
      cover_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg",
      header_image: "",
    };
    expect(hasUsableCardImage(row)).toBe(true);
  });

  it("accepts Steam library cover (will be validated in repair pipeline)", () => {
    const row = {
      cover_image: "https://cdn.akamai.steamstatic.com/steam/apps/123456/library_600x900_2x.jpg",
      header_image: "",
    };
    expect(hasUsableCardImage(row)).toBe(true);
  });

  it("accepts games with validated media_source", () => {
    const row = {
      cover_image: "https://example.com/cover.jpg",
      header_image: "",
      media_source: "steam",
    };
    expect(hasUsableCardImage(row)).toBe(true);
  });

  it("accepts any non-empty URL", () => {
    const row = {
      cover_image: "https://example.com/some-cover.jpg",
      header_image: "",
    };
    expect(hasUsableCardImage(row)).toBe(true);
  });
});

describe("isSteamLibraryCover", () => {
  it("detects Steam library cover URLs", () => {
    expect(isSteamLibraryCover("https://cdn.akamai.steamstatic.com/steam/apps/123456/library_600x900_2x.jpg")).toBe(true);
    expect(isSteamLibraryCover("https://cdn.akamai.steamstatic.com/steam/apps/789/library_600x900.jpg")).toBe(true);
  });

  it("does not flag non-Steam URLs", () => {
    expect(isSteamLibraryCover("https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060c14e96612001.jpg")).toBe(false);
    expect(isSteamLibraryCover("https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg")).toBe(false);
  });

  it("does not flag Steam header URLs", () => {
    expect(isSteamLibraryCover("https://cdn.akamai.steamstatic.com/steam/apps/123456/header.jpg")).toBe(false);
  });
});
