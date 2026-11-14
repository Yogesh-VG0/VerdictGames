import { describe, expect, it } from 'vitest';
import { groupSteamPlayerRows } from '../../../../scripts/lib/steam-player-groups.mjs';

describe('Steam player request groups', () => {
  it('requests one app once while retaining all separate row identities', () => {
    const rows = [{ id: 'canonical', steam_app_id: 42 }, { id: 'legacy-url', steam_app_id: '42' }, { id: 'other', steam_app_id: 43 }];
    expect(groupSteamPlayerRows(rows)).toEqual([
      { appId: 42, rows: rows.slice(0, 2) }, { appId: 43, rows: rows.slice(2) },
    ]);
  });
  it('does not send invalid identifiers to Steam', () => {
    expect(groupSteamPlayerRows([{ steam_app_id: 0 }, { steam_app_id: null }, { steam_app_id: 'oops' }])).toEqual([]);
  });
});
