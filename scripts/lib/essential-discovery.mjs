const MAX_CANDIDATES = 120;
const MAX_INGESTIONS = 12;

export async function selectEssentialDiscoveryGames(sql, games) {
  const byRawgId = new Map();
  for (const game of games) {
    if (Number.isSafeInteger(game.id) && game.id > 0 && !byRawgId.has(game.id)) {
      byRawgId.set(game.id, game);
      if (byRawgId.size === MAX_CANDIDATES) break;
    }
  }
  if (byRawgId.size === 0) return [];

  const known = await sql`
    SELECT DISTINCT rawg_id FROM public.games
    WHERE rawg_id = ANY(${[...byRawgId.keys()]}::int[])
  `;
  for (const { rawg_id } of known) byRawgId.delete(rawg_id);
  return [...byRawgId.values()].slice(0, MAX_INGESTIONS);
}
