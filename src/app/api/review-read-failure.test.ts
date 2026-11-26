import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as readProfileReviews } from "./profile/[username]/reviews/route";
import { GET as readComments } from "./reviews/[id]/comments/route";

const mocks = vi.hoisted(() => ({ configured: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({
  hasPublicSupabaseEnv: mocks.configured,
  getPublicSupabase: () => ({ from: mocks.from }),
}));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: vi.fn(), getAuthSupabase: vi.fn() }));

const request = new NextRequest("http://localhost");
const routes = [
  { label: "profile reviews", get: () => readProfileReviews(request, { params: Promise.resolve({ username: "test-user" }) }) },
  { label: "review comments", get: () => readComments(request, { params: Promise.resolve({ id: "test-review" }) }) },
];

function databaseResponse(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const chain = {
    select: () => chain, eq: () => chain, order: () => chain,
    limit: () => result, maybeSingle: () => result,
  };
  mocks.from.mockReturnValue(chain);
}

describe.each(routes)("$label outage handling", ({ get }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.configured.mockReturnValue(true);
  });

  it.each(["configuration", "database"])("returns a retryable private response on %s failure", async (cause) => {
    if (cause === "configuration") mocks.configured.mockReturnValue(false);
    else databaseResponse(null, new Error("controlled read failure"));
    const response = await get();
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ success: false });
  });

  it("keeps an observed empty result successful", async () => {
    databaseResponse(null);
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: [] });
  });
});
