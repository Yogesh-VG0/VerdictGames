import { describe, expect, it, vi } from 'vitest';
import { getFreshPlayerSignals } from '../utils/trending';
import { fetchSteamReviews } from '../external/steam-reviews-api.mjs';
import { recordMaintenanceAttempt } from '../../../scripts/lib/maintenance-due.mjs';
import { getProvider, providerBudgets } from '../../../scripts/lib/maintenance-provider-budget.mjs';

describe('consolidated maintenance safeguards', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');

  it('uses only current observed activity for live ranking', () => {
    const row = { current_players: 500, momentum: 0.6 };
    expect(getFreshPlayerSignals({ ...row, players_updated_at: '2026-11-24T11:30:00Z' }, now))
      .toEqual({ players: 500, momentum: 0.6 });
    for (const players_updated_at of [null, '2026-11-23T11:59:59Z', '2026-11-24T12:00:01Z']) {
      expect(getFreshPlayerSignals({ ...row, players_updated_at }, now)).toEqual({ players: 0, momentum: 0 });
    }
  });

  it('keeps both observed malformed Steam payloads out of the successful refresh path', async () => {
    const fake = (response: unknown) => vi.fn(async () => Response.json({ response }));
    await expect(fetchSteamReviews(42, {}, fake({}))).rejects.toMatchObject({ steamReviewReason: 'invalid_summary' });
    await expect(fetchSteamReviews(42, {}, fake({ query_summary: { total_reviews: 0 } })))
      .rejects.toMatchObject({ steamReviewReason: 'zero_summary_without_reviews' });
    await expect(fetchSteamReviews(42, {}, fake({ reviews: [], query_summary: { total_reviews: 0 } })))
      .resolves.toMatchObject({ reviews: [] });
  });

  it('starts a failed item retry independently of its successful refresh interval', async () => {
    const sql = vi.fn<(_template: TemplateStringsArray, ...values: unknown[]) => Promise<void>>(async () => {});
    await recordMaintenanceAttempt(sql, 'app_store', 'game-one', false, 35);
    expect(sql.mock.calls[0]?.slice(1)).toEqual(['app_store', 'game-one', 1, 1, false, false, 35]);
    await recordMaintenanceAttempt(sql, 'app_store', 'game-one', true, 35);
    expect(sql.mock.calls[1]?.slice(1)).toEqual(['app_store', 'game-one', 35, 0, true, true, 35]);
  });

  it('keeps the measured Steam requests and the independent RAWG path within distinct budgets', () => {
    expect(getProvider(new Request('https://api.steampowered.com/demo'))).toBe('steam');
    expect(getProvider('https://api.rawg.io/api/games')).toBe('rawg');
    expect(getProvider('https://api.rawg.io.invalid/api/games')).toBe('other');
    expect(providerBudgets['refresh-player-counts']).toEqual({ steam: 36 });
    expect(providerBudgets['refresh-upcoming-snapshot']).toEqual({ rawg: 50 });
  });
});
