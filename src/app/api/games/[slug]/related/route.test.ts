import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { RelatedDependencyError } from "@/lib/services/related-errors";

const mocks = vi.hoisted(() => ({
  loadTarget: vi.fn(), related: vi.fn(),
}));
vi.mock("@/lib/services/game-detail", () => ({ loadRelatedGameTarget: mocks.loadTarget }));
vi.mock("@/lib/services/relatedGames", () => ({
  getRelatedGamesForGame: mocks.related,
  RELATED_GAMES_REVALIDATE_SECONDS: 300,
  RELATED_GAMES_API_CACHE_CONTROL: "s-maxage=300, stale-while-revalidate=300",
}));

import { GET } from "./route";

const request = new NextRequest("https://verdict.games/api/games/target/related?limit=6");
const handle = () => GET(request, { params: Promise.resolve({ slug: "target" }) });
const target = { slug: "canonical-target" };
const timeout = () => new DOMException("deadline", "TimeoutError");

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.loadTarget.mockReset().mockResolvedValue(target);
  mocks.related.mockReset().mockResolvedValue([{ id: "valid" }]);
});

describe("related games route", () => {
  it("returns the resolved canonical slug and forwards the requested limit", async () => {
    const response = await handle();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-verdict-canonical-slug")).toBe("canonical-target");
    expect(mocks.related).toHaveBeenCalledWith(target, 6);
  });

  it("stops for an invalid, blocked or missing target", async () => {
    mocks.loadTarget.mockResolvedValue(null);
    expect((await handle()).status).toBe(404);
    expect(mocks.related).not.toHaveBeenCalled();
  });

  it("omits request URLs and arbitrary upstream error details from diagnostics", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const sensitive = "private-source-url-and-credential";
    mocks.related.mockRejectedValue(new Error(sensitive));
    const response = await handle();
    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledExactlyOnceWith("[Related games] Request failed", {
      stage: "candidate-lookup", reason: "unexpected",
    });
    expect(await response.text()).not.toContain(sensitive);
  });

  it.each([
    ["game-resolution", "game-resolution-timeout", timeout()],
    ["candidate-lookup", "candidate-lookup-timeout", timeout()],
    ["game-resolution", "provider-failure", new RelatedDependencyError("provider-failure")],
    ["candidate-lookup", "database-transport-timeout", new RelatedDependencyError("database-transport-timeout")],
    ["candidate-lookup", "database-unavailable", new RelatedDependencyError("database-unavailable")],
  ] as const)("reports %s as %s without caching an error", async (stage, reason, error) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    (stage === "game-resolution" ? mocks.loadTarget : mocks.related).mockRejectedValue(error);
    const response = await handle();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).not.toContain("s-maxage");
    expect(log).toHaveBeenCalledWith("[Related games] Request failed", { stage, reason });
    expect(await response.text()).not.toContain(reason);
  });
});
