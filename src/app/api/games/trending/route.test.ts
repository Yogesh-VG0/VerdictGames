import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ load: vi.fn(), configured: vi.fn() }));
vi.mock("@/lib/services/search", () => ({ loadSearchResults: mocks.load, SEARCH_PAGE_SIZE: 25 }));
vi.mock("@/lib/supabase/public", () => ({ hasPublicSupabaseEnv: mocks.configured }));

const request = (limit = "") => new NextRequest(`https://example.test/api/games/trending${limit}`);

describe("Trending endpoint", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.configured.mockReturnValue(true);
  });

  it("caches a confirmed empty result and uses the dedicated growth sort", async () => {
    mocks.load.mockResolvedValue({ items: [], total: 0 });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=60");
    expect(await response.json()).toEqual({ success: true, data: [] });
    expect(mocks.load).toHaveBeenCalledWith(expect.objectContaining({ sort: "trending", page: 1 }));
  });

  it.each(["read failure", "incomplete snapshot", "missing configuration"])("fails closed on %s", async (scenario) => {
    if (scenario === "read failure") mocks.load.mockRejectedValue(new Error("test read timeout"));
    if (scenario === "incomplete snapshot") mocks.load.mockResolvedValue({ items: [], total: 1 });
    if (scenario === "missing configuration") mocks.configured.mockReturnValue(false);
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    for (const header of ["Cache-Control", "CDN-Cache-Control", "Vercel-CDN-Cache-Control"]) {
      expect(response.headers.get(header)).toContain("no-store");
    }
    expect(await response.json()).toMatchObject({ success: false });
  });

  it.each(["?limit=0", "?limit=26", "?limit=5games", "?limit="])("validates %s without querying", async (query) => {
    expect((await GET(request(query))).status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
