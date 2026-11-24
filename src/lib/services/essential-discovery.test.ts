import { describe, expect, it, vi } from "vitest";
import { selectEssentialDiscoveryGames } from "../../../scripts/lib/essential-discovery.mjs";

describe("essential discovery ingest budget", () => {
  it("queries at most 120 distinct provider IDs once and attempts at most 12 unknown games", async () => {
    const incoming = Array.from({ length: 160 }, (_, i) => ({ id: i + 1, slug: `game-${i + 1}` }));
    const sql = vi.fn<(query: TemplateStringsArray, ids: number[]) => Promise<{ rawg_id: number }[]>>(
      async () => Array.from({ length: 90 }, (_, i) => ({ rawg_id: i + 1 })),
    );
    const games = await selectEssentialDiscoveryGames(sql, [incoming[0], { id: -1 }, ...incoming]);

    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][1]).toEqual(incoming.slice(0, 120).map(game => game.id));
    expect(games).toEqual(incoming.slice(90, 102));
  });

  it("skips the database when all provider identities are invalid", async () => {
    const sql = vi.fn();
    await expect(selectEssentialDiscoveryGames(sql, [{ id: 0 }, { id: "4" }])).resolves.toEqual([]);
    expect(sql).not.toHaveBeenCalled();
  });
});
