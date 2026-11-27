import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, unknown>(), calls: [] as string[], fail: "", missing: false,
  rows: [] as Array<Record<string, unknown>>,
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys: string[]) => async (...args: unknown[]) => {
    const key = JSON.stringify([keys, args]);
    if (mocks.cache.has(key)) return mocks.cache.get(key);
    const value = await fn(...args);
    mocks.cache.set(key, value);
    return value;
  },
}));
vi.mock("@/lib/supabase/public", () => ({
  hasPublicSupabaseEnv: () => !mocks.missing,
  getPublicSupabase: () => ({
    from: () => {
      let matches: (row: Record<string, unknown>) => boolean = () => true;
      const builder = {
        select: () => builder, neq: (column: string, id: string) => {
          if (column === "id") mocks.calls.push("exclude:" + id);
          return builder;
        },
        not: () => builder, order: () => builder,
        eq: (column: string, value: string) => { matches = row => row[column] === value; return builder; },
        contains: (column: string, [value]: string[]) => {
          matches = row => Array.isArray(row[column]) && (row[column] as string[]).includes(value);
          return builder;
        },
        lte: () => builder,
        limit: () => builder,
        abortSignal: async () => {
          mocks.calls.push("candidate");
          if (mocks.fail && mocks.calls.filter(x => x === "candidate").length === 2) {
            return { data: null, error: { code: mocks.fail } };
          }
          return { data: mocks.rows.filter(row => matches(row)), error: null };
        },
      };
      return builder;
    },
  }),
}));

import { getRelatedGamesForGame } from "./relatedGames";
import { RelatedDependencyError, relatedDatabaseError, relatedFailureReason } from "./related-errors";

const game = {
  id: "00000000-0000-0000-0000-000000000001", slug: "target", title: "Target",
  genres: ["Adventure", "RPG"], tags: ["Story Rich", "Choices Matter", "Exploration"],
  platforms: ["PC" as const], developer: "Studio", publisher: "Publisher", franchise: "Series",
  releaseDate: "2020-01-01",
};

function row(id: string, label: string, quality: boolean, extra = {}) {
  return {
    id, slug: label.toLowerCase().replace(/ /g, "-"), title: label,
    cover_image: "https://media.rawg.io/media/games/example.jpg",
    header_image: "https://media.rawg.io/media/games/example.jpg",
    description: quality ? "A long enough real description for a quality result." : "Short",
    genres: ["Adventure"], tags: [], platforms: ["PC"], score: 70, confidence: 0.5,
    verdict_score: 70, developer: quality ? "Elsewhere" : "Studio", publisher: "Publisher",
    steam_total_count: quality ? 150 : 1,
    franchise: quality ? null : "Series", review_count: quality ? 150 : 1,
    release_date: "2020-01-01", release_status: "released",
    ...extra,
  };
}

beforeEach(() => {
  mocks.cache.clear();
  mocks.calls.length = 0;
  mocks.fail = "";
  mocks.missing = false;
  mocks.rows = [
    ...Array.from({ length: 8 }, (_, i) => row("e" + i, "Eligible " + i, false)),
    ...Array.from({ length: 4 }, (_, i) => row("q" + i, "Quality " + i, true)),
    row("q-copy", "Quality 0", true, { review_count: 15 }),
    row("unsafe", "Outlier", true, { tags: ["Hentai"] }),
    row("future", "Future", true, { release_date: "2099-01-01" }),
    row("self", "Target", true),
  ];
});

describe("related-games candidate", () => {
  it("preserves the limit-dependent pools for every supported limit and does one round of queries", async () => {
    const alwaysEligible = [...Array.from({ length: 8 }, (_, i) => "e" + i),
      ...Array.from({ length: 4 }, (_, i) => "q" + i)];
    for (let limit = 1; limit <= 12; limit++) {
      const games = await getRelatedGamesForGame(game, limit);
      const pool = limit <= 4 ? alwaysEligible.slice(8) : alwaysEligible;
      expect(games.map(candidate => candidate.id), "limit " + limit).toEqual(pool.slice(0, limit));
    }
    expect(mocks.calls.filter(x => x === "candidate")).toHaveLength(8);
    expect([...mocks.cache.keys()]).toHaveLength(1);
  });

  it("fails closed on a partially failed query group and does not cache it", async () => {
    mocks.fail = "57014";
    const attempts = await Promise.allSettled([getRelatedGamesForGame(game, 4), getRelatedGamesForGame(game, 5)]);
    expect(attempts).toEqual(Array.from({ length: 2 }, () => ({
      status: "rejected",
      reason: expect.objectContaining({ reason: "database-query-cancelled" }),
    })));
    expect(mocks.cache.size).toBe(0);
    expect(mocks.calls.filter(x => x === "candidate")).toHaveLength(2);
    mocks.fail = "";
    await expect(getRelatedGamesForGame(game, 4)).resolves.toHaveLength(4);
  });

  it("coalesces one process's cold ranking reads across simultaneous limits", async () => {
    const lengths = Array.from({ length: 12 }, (_, index) => index + 1);
    const results = await Promise.all(lengths.map(limit => getRelatedGamesForGame(game, limit)));
    expect(results.map(result => result.length)).toEqual(lengths);
    expect(mocks.calls.filter(x => x === "candidate")).toHaveLength(8);
  });

  it("refreshes rankings once observed inputs for a known target identity change", async () => {
    await expect(getRelatedGamesForGame(game, 4)).resolves.toHaveLength(4);
    mocks.rows = mocks.rows.filter(row => row.id !== "q0");
    const updated = await getRelatedGamesForGame({ ...game, publisher: "New Publisher" }, 4);
    expect(updated.map(row => row.id)).not.toContain("q0");
    expect(mocks.calls.filter(x => x === "candidate")).toHaveLength(16);
  });

  it("does not send synthetic previews to a UUID filter", async () => {
    await getRelatedGamesForGame({ ...game, id: "rawg-42", isPreview: true }, 5);
    expect(mocks.calls.some(x => x.startsWith("exclude:"))).toBe(false);
  });

  it("reports database unavailability without storing an empty result", async () => {
    mocks.missing = true;
    await expect(getRelatedGamesForGame(game)).rejects.toMatchObject({ reason: "database-unavailable" });
    expect(mocks.cache.size).toBe(0);
  });

  it("distinguishes stage deadlines, transport deadlines and provider errors", () => {
    const timeout = new DOMException("deadline", "TimeoutError");
    const clear = new AbortController().signal;
    expect(relatedFailureReason("game-resolution", timeout)).toBe("game-resolution-timeout");
    expect(relatedFailureReason("candidate-lookup", timeout)).toBe("candidate-lookup-timeout");
    expect(relatedFailureReason("game-resolution", new RelatedDependencyError("provider-failure"))).toBe("provider-failure");
    expect(relatedFailureReason("candidate-lookup", relatedDatabaseError({ code: "57014" }, clear))).toBe("database-query-cancelled");
    expect(relatedFailureReason("candidate-lookup", relatedDatabaseError({}, AbortSignal.abort(timeout)))).toBe("database-transport-timeout");
    expect(relatedFailureReason("candidate-lookup", relatedDatabaseError({ code: "PGRST000" }, clear))).toBe("database-unavailable");
    expect(relatedDatabaseError({}, clear, AbortSignal.abort(timeout))).toBe(timeout);
  });
});
