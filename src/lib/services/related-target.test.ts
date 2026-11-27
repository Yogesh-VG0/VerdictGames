import { beforeEach, expect, it, vi } from "vitest";
import { GAME_DETAIL_SLUG_REDIRECTS, loadRelatedGameTarget } from "./game-detail";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(),
  result: { data: null as null | Record<string, unknown>, error: null as null | { code: string } },
  getRawgGame: vi.fn(), getRawgScreenshots: vi.fn(), getRawgStoreLinks: vi.fn(), searchRawg: vi.fn(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/external/rawg", async original => ({
  ...(await original<typeof import("@/lib/external/rawg")>()),
  getRawgGame: mocks.getRawgGame,
  getRawgScreenshots: mocks.getRawgScreenshots,
  getRawgStoreLinks: mocks.getRawgStoreLinks,
  searchRawg: mocks.searchRawg,
}));
vi.mock("@/lib/supabase/public", () => ({
  hasPublicSupabaseEnv: () => true,
  getPublicSupabase: () => ({ from: mocks.from }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  const builder = {
    select: mocks.select, eq: mocks.eq, abortSignal: () => builder,
    maybeSingle: async () => mocks.result,
  };
  mocks.from.mockReturnValue(builder);
  mocks.select.mockReturnValue(builder);
  mocks.eq.mockReturnValue(builder);
  mocks.getRawgGame.mockRejectedValue(new Error("provider unavailable"));
  mocks.getRawgScreenshots.mockResolvedValue([]);
  mocks.getRawgStoreLinks.mockResolvedValue([]);
  mocks.searchRawg.mockResolvedValue({ results: [] });
  mocks.result = { data: {
    id: "target", slug: "target", title: "Fixture Target", genres: ["RPG"],
    tags: ["Exploration"], platforms: ["PC"], developer: "Studio", publisher: "Publisher",
    franchise: null, release_date: "2021-03-04", description: "A safe description for this game.",
  }, error: null };
});

it("reads only the related ranking projection and normalizes the existing alias", async () => {
  const [alias, canonical] = Object.entries(GAME_DETAIL_SLUG_REDIRECTS)[0];
  expect(await loadRelatedGameTarget(alias)).toMatchObject({
    id: "target", releaseDate: "2021-03-04", platforms: ["PC"],
  });
  expect(mocks.eq).toHaveBeenCalledWith("slug", canonical);
  expect(mocks.from.mock.calls).toEqual([["games"]]);
  expect(mocks.select.mock.calls[0][0].split(",")).toHaveLength(11);
  expect(mocks.getRawgGame).not.toHaveBeenCalled();
});

it("rejects invalid and non-public results without calling the provider", async () => {
  await expect(loadRelatedGameTarget("not/a/slug")).resolves.toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
  mocks.result.data = { ...mocks.result.data, tags: ["Hentai"] };
  await expect(loadRelatedGameTarget("target")).resolves.toBeNull();
  expect(mocks.getRawgGame).not.toHaveBeenCalled();
});

it("shares one cold target read for the canonical slug and its known alias", async () => {
  const [alias, canonical] = Object.entries(GAME_DETAIL_SLUG_REDIRECTS)[0];
  const [aliasTarget, canonicalTarget] = await Promise.all([
    loadRelatedGameTarget(alias), loadRelatedGameTarget(canonical),
  ]);
  expect(aliasTarget).toEqual(canonicalTarget);
  expect(mocks.from).toHaveBeenCalledTimes(1);
});

it("retains a safe RAWG preview with its normalized synthetic identity", async () => {
  mocks.result.data = null;
  mocks.getRawgGame.mockResolvedValue({
    id: 73, name: "Provider Game", slug: "provider-game", released: "2010-01-01",
    description_raw: "A safe provider preview.", platforms: [], genres: [], tags: [],
  });
  await expect(loadRelatedGameTarget("provider-game")).resolves.toMatchObject({
    id: "rawg-73", slug: "provider-game", isPreview: true,
  });
  mocks.getRawgGame.mockResolvedValue({
    id: 74, name: "Unsafe Provider Game", slug: "unsafe", esrb_rating: { slug: "adults-only" },
  });
  await expect(loadRelatedGameTarget("unsafe")).resolves.toBeNull();
});

it("does not fall through to the provider when the database is unavailable", async () => {
  mocks.result = { data: null, error: { code: "PGRST000" } };
  await expect(loadRelatedGameTarget("target")).rejects.toMatchObject({ reason: "database-unavailable" });
  expect(mocks.getRawgGame).not.toHaveBeenCalled();
});

it("classifies a provider failure separately on a known database miss", async () => {
  mocks.result.data = null;
  await expect(loadRelatedGameTarget("target")).rejects.toMatchObject({ reason: "provider-failure" });
  expect(mocks.getRawgGame).toHaveBeenCalledWith("target");
});
