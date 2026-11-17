import { describe, expect, it } from 'vitest';
import { missingMaintenanceSecrets } from '../../../scripts/lib/maintenance-config.mjs';

describe('scheduled maintenance provider prerequisites', () => {
  const database = { SUPABASE_DB_URL: 'local-test-only' };
  it('allows existing Steam refreshes with RAWG permanently absent', () => {
    expect(missingMaintenanceSecrets('refresh-trending', database)).toEqual([]);
    expect(missingMaintenanceSecrets('refresh-steam-reviews', database)).toEqual([]);
    expect(missingMaintenanceSecrets('refresh-trending', {})).toEqual(['SUPABASE_DB_URL']);
  });
  it('requires a complete independent discovery provider', () => {
    for (const job of ['discover-standard', 'discover-deep']) {
      expect(missingMaintenanceSecrets(job, database)).toEqual(['RAWG_API_KEY-or-TWITCH-credentials']);
      expect(missingMaintenanceSecrets(job, { ...database, TWITCH_CLIENT_ID: 'test' })).toHaveLength(1);
      expect(missingMaintenanceSecrets(job, { ...database, TWITCH_CLIENT_ID: 'test', TWITCH_CLIENT_SECRET: 'test' })).toEqual([]);
      expect(missingMaintenanceSecrets(job, { ...database, RAWG_API_KEY: 'test' })).toEqual([]);
    }
  });
  it('retains prerequisites for RAWG-dependent historical and enrichment jobs', () => {
    for (const job of ['re-enrich', 'backfill-games']) {
      expect(missingMaintenanceSecrets(job, database)).toEqual(['RAWG_API_KEY']);
    }
  });
});
