import { describe, expect, it } from "vitest";
import type { GameRow } from "@/lib/supabase/types";
import { selectHomepagePopularity } from "./homepage-popularity";

const now = Date.parse("2026-11-26T12:00:00Z");
const observed = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
function row(id: number, values: Partial<GameRow> = {}): GameRow {
  return {
    id: String(id), slug: `game-${id}`, title: `Game ${id}`,
    steam_app_id: id, release_date: "2024-05-15", release_status: "released",
    cover_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg",
    description: "A standalone game with an extended single-player adventure.",
    platforms: ["PC"], genres: ["Adventure"], tags: [], score: 88, verdict_score: 88, confidence: 0.9,
    ...values,
  } as GameRow;
}

describe("homepage popularity evidence", () => {
  it("distinguishes growth, activity, dated momentum, long-term evidence and editorial picks", () => {
    const rows = [
      row(4, { steam_total_count: 100_000, players_updated_at: observed(169), current_players: 5000, momentum: 0.2 }),
      row(2, { players_updated_at: observed(3), current_players: 5000, momentum: -0.2 }),
      row(1, { players_updated_at: observed(24), current_players: 1000, momentum: Math.log(1.2) }),
      row(3, { players_updated_at: observed(168), current_players: 1000, momentum: Math.log(1.2) }),
      row(5, { is_trending_manual: true }),
      row(6, { review_count: 500_000 }),
      row(7, { players_updated_at: observed(-1), current_players: 5000, momentum: 0.2 }),
      row(8, { release_status: "withdrawn", is_trending_manual: true }),
      row(9, { is_provisional: true, is_trending_manual: true }),
      row(10, { players_updated_at: observed(3), current_players: 5000, momentum: 0.2, steam_app_id: null }),
      row(11, { release_date: "2025-12-31", release_status: null, is_trending_manual: true }),
    ];
    const result = selectHomepagePopularity(rows, 20, now);
    expect(result.picks.map(({ reason }) => reason)).toEqual([
      "Trending Up", "Popular Now", "Past Momentum", "Established Popularity", "Editor's Pick",
    ]);
    expect(result.exclusions).toMatchObject({ release: 3, evidence: 3 });
    expect(selectHomepagePopularity(rows, 20, now, true).picks.map(({ reason }) => reason))
      .toEqual(["Established Popularity", "Editor's Pick"]);
  });

  it("keeps the verified current Steam identity across overlapping evidence pools", () => {
    const current = row(1, { title: "Counter-Strike 2", steam_app_id: 730, players_updated_at: observed(3), current_players: 3500, momentum: 0.15 });
    const old = row(2, { title: "Counter-Strike: Global Offensive", steam_app_id: 730, steam_total_count: 5_000_000 });
    const result = selectHomepagePopularity([old, current, current], 20, now);
    expect(result.picks.map(({row, reason}) => [row.title, reason])).toEqual([["Counter-Strike 2", "Trending Up"]]);
    expect(result.exclusions.duplicate).toBe(2);
  });
});
