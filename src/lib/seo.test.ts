import { describe, expect, it } from "vitest";
import { getGameDatePublished } from "./seo";

describe("game publication dates", () => {
  const today = "2026-11-25";
  const released = { releaseStatus: "full-release", releaseDate: "2025-09-25" };

  it("uses a verified full-release day", () => {
    expect(getGameDatePublished(released, today)).toBe("2025-09-25");
    expect(getGameDatePublished({
      ...released, releaseTiming: { precision: "day", value: "2025-09-24" },
    }, today)).toBe("2025-09-24");
  });

  it.each(["upcoming", "early-access", "tba", "cancelled", undefined])(
    "omits an elapsed date with lifecycle status %s",
    releaseStatus => expect(getGameDatePublished({ ...released, releaseStatus }, today)).toBeUndefined(),
  );

  it("omits dates for previews, provisional games, and imprecise or invalid dates", () => {
    expect(getGameDatePublished({ ...released, isPreview: true }, today)).toBeUndefined();
    expect(getGameDatePublished({ ...released, isProvisional: true }, today)).toBeUndefined();
    expect(getGameDatePublished({ ...released, releaseDateTba: true }, today)).toBeUndefined();
    expect(getGameDatePublished({ ...released, releaseTiming: { precision: "year", value: "2025" } }, today)).toBeUndefined();
    expect(getGameDatePublished({ ...released, releaseDate: "2025-02-30" }, today)).toBeUndefined();
    expect(getGameDatePublished({ ...released, releaseDate: "2026-12-01" }, today)).toBeUndefined();
  });
});
