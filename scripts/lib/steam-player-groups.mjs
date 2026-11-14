/** Group provider calls without merging records, relationships, or slugs. */
export function groupSteamPlayerRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const appId = Number(row.steam_app_id);
    if (!Number.isSafeInteger(appId) || appId <= 0) continue;
    const group = groups.get(appId) ?? { appId, rows: [] };
    group.rows.push(row);
    groups.set(appId, group);
  }
  return [...groups.values()];
}
