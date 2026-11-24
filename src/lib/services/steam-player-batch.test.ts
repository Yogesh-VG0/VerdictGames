import { describe, expect, it, vi } from "vitest";
import { observedSteamPlayers, readSteamPlayerBatch } from "../../../scripts/lib/steam-player-batch.mjs";

const row = (id: number) => ({
  id: `00000000-0000-0000-0000-${String(id).padStart(12, "0")}`,
  title: `Game ${id}`,
  steam_app_id: id,
});

function fixture(results: unknown[][]) {
  return vi.fn<(_query: TemplateStringsArray, ...parameters: unknown[]) => Promise<unknown[]>>(
    async () => results.shift() ?? [],
  );
}

describe("bounded Steam player observations", () => {
  it("selects twelve priority rows plus at most twenty-four rotating rows", async () => {
    const priority = Array.from({ length: 12 }, (_, i) => row(i + 1));
    const rotating = Array.from({ length: 24 }, (_, i) => row(i + 40));
    const previousCursor = row(39).id;
    const sql = fixture([priority, [{ cursor: previousCursor }], rotating]);

    await expect(readSteamPlayerBatch(sql)).resolves.toEqual({
      rows: [...priority, ...rotating],
      cursor: rotating.at(-1)?.id,
    });
    expect(sql).toHaveBeenCalledTimes(3);
    expect(sql.mock.calls[0][1]).toBe(12);
    expect(sql.mock.calls[2].slice(1)).toEqual([previousCursor, priority.map(game => game.id), 24]);
  });

  it("wraps the cursor using only the remaining budget and excludes priority rows", async () => {
    const previousCursor = row(98).id;
    const sql = fixture([[row(1)], [{ cursor: previousCursor }], [row(99)], [row(2), row(3)]]);

    await expect(readSteamPlayerBatch(sql)).resolves.toEqual({
      rows: [row(1), row(99), row(2), row(3)],
      cursor: row(3).id,
    });
    expect(sql.mock.calls[3].slice(1)).toEqual([previousCursor, [row(1).id], 23]);
  });

  it("records only genuine current counts, including observed zero", () => {
    expect(observedSteamPlayers({ response: { result: 1, player_count: 0, peak_in_game: 900 } })).toBe(0);
    expect(observedSteamPlayers({ response: { result: 1, player_count: 42 } })).toBe(42);
    for (const player_count of [null, undefined, "0", -1, 1.5, 2_147_483_648]) {
      expect(observedSteamPlayers({ response: { result: 1, player_count, peak_in_game: 900 } })).toBeNull();
    }
    expect(observedSteamPlayers({ response: { result: 2, player_count: 42 } })).toBeNull();
  });
});
