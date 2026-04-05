import { describe, expect, it } from "vitest";
import { computeConfidence, effectiveEvidenceReviewCount, resolveCommunityEvidenceSource } from "../scoring";

describe("scoring evidence trust", () => {
  it("prefers direct Steam evidence over fallback counts", () => {
    const steamConfidence = computeConfidence(4000, 0, "steam");
    const fallbackConfidence = computeConfidence(4000, 0, "fallback");

    expect(steamConfidence).toBeGreaterThan(fallbackConfidence);
    expect(steamConfidence - fallbackConfidence).toBeGreaterThan(0.25);
  });

  it("heavily discounts fallback review volume", () => {
    expect(effectiveEvidenceReviewCount(4000, "steam")).toBe(4000);
    expect(effectiveEvidenceReviewCount(4000, "fallback")).toBe(300);
    expect(effectiveEvidenceReviewCount(0, "fallback")).toBe(0);
  });

  it("resolves community evidence source in the expected priority order", () => {
    expect(resolveCommunityEvidenceSource({
      steamTotalCount: 1200,
      hasSteamData: true,
      rawgRating: 4.7,
      reviewCount: 1200,
    })).toBe("steam");

    expect(resolveCommunityEvidenceSource({
      rawgRating: 4.4,
      reviewCount: 800,
    })).toBe("fallback");

    expect(resolveCommunityEvidenceSource({
      rawgRating: null,
      reviewCount: 0,
    })).toBe("none");
  });
});
