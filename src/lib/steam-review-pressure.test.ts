import { describe, expect, it, vi } from 'vitest';
vi.mock('./external/steam-reviews-api.mjs', () => ({ fetchSteamReviews: vi.fn().mockResolvedValue({ reviews: [] }) }));
import { refreshReviewBatch } from '../../scripts/refresh-steam-reviews.mjs';

describe('Steam review maintenance backpressure', () => {
  it.each(['57014', 'ECHECKOUTTIMEOUT'])('stops without failure-marker writes or another game after %s', async code => {
    const failure = Object.assign(new Error('Controlled resource exhaustion'), { code });
    const sql = Object.assign(vi.fn().mockResolvedValue([
      { id: 'local-first', steam_app_id: 1 }, { id: 'local-second', steam_app_id: 2 },
    ]), { begin: vi.fn().mockRejectedValue(failure) });
    await expect(refreshReviewBatch(sql, { limit: 2, pauseMs: 0 })).rejects.toBe(failure);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.begin).toHaveBeenCalledTimes(1);
  });
});
