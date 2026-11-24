const PRIORITY_LIMIT = 12;
const ROTATION_LIMIT = 24;
const EMPTY_CURSOR = "00000000-0000-0000-0000-000000000000";

export function observedSteamPlayers(payload) {
  const { result, player_count: count } = payload?.response ?? {};
  return result === 1 && Number.isInteger(count) && count >= 0 && count <= 2_147_483_647 ? count : null;
}

export async function readSteamPlayerBatch(sql) {
  const priority = await sql`
    SELECT id, title, steam_app_id FROM public.games
    WHERE steam_app_id > 0 AND (trending IS TRUE OR is_featured_manual IS TRUE OR current_players >= 1000)
    ORDER BY current_players DESC NULLS LAST, id
    LIMIT ${PRIORITY_LIMIT}
  `;
  const [lastRun] = await sql`
    SELECT metadata->>'player_cursor' AS cursor FROM public.scheduler_runs
    WHERE job_name IN ('refresh-trending', 'refresh-player-counts') AND metadata ? 'player_cursor'
    ORDER BY started_at DESC LIMIT 1
  `;
  const cursor = lastRun?.cursor ?? EMPTY_CURSOR;
  const priorityIds = priority.map(row => row.id);
  const rotating = await sql`
    SELECT id, title, steam_app_id FROM public.games
    WHERE steam_app_id > 0 AND id > ${cursor}::uuid AND id <> ALL(${priorityIds}::uuid[])
    ORDER BY id LIMIT ${ROTATION_LIMIT}
  `;
  const remaining = ROTATION_LIMIT - rotating.length;
  const wrapped = remaining > 0 && cursor !== EMPTY_CURSOR ? await sql`
    SELECT id, title, steam_app_id FROM public.games
    WHERE steam_app_id > 0 AND id <= ${cursor}::uuid AND id <> ALL(${priorityIds}::uuid[])
    ORDER BY id LIMIT ${remaining}
  ` : [];
  return {
    rows: [...priority, ...rotating, ...wrapped],
    cursor: wrapped.at(-1)?.id ?? rotating.at(-1)?.id ?? cursor,
  };
}
