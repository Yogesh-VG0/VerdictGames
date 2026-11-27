import type { Game } from "@/lib/types";
import { getPublicCanonicalGroup } from "@/lib/utils/publicCanonical";

export const HOMEPAGE_REPEAT_BUDGET = {
  hero: 0, trending: 3, topRated: 4, newReleases: 8, recommendations: 0,
} as const;
const maxAppearances = 3;

function slotIdentity(game: Game) {
  return getPublicCanonicalGroup({ title: game.title, steam_app_id: game.steamAppId ?? null, franchise: game.franchise ?? null });
}

export function createHomepageSlots() {
  const appearances = new Map<string, number>();
  const wasClaimed = (game: Game) => appearances.has(slotIdentity(game));

  function claim(candidates: Game[], max: number, section: keyof typeof HOMEPAGE_REPEAT_BUDGET): Game[] {
    const repeatBudget = HOMEPAGE_REPEAT_BUDGET[section];
    const ordered = [...candidates.filter(game => !wasClaimed(game)), ...candidates.filter(wasClaimed)];
    const selected = new Map<string, Game>();
    let repeats = 0;
    for (const game of ordered) {
      if (selected.size >= max) break;
      const id = slotIdentity(game);
      const count = appearances.get(id) ?? 0;
      if (selected.has(id) || count >= maxAppearances || count > 0 && repeats >= repeatBudget) continue;
      if (count > 0) repeats++;
      selected.set(id, game);
    }
    for (const id of selected.keys()) appearances.set(id, (appearances.get(id) ?? 0) + 1);
    return [...selected.values()];
  }

  return { claim, wasClaimed };
}
