import { beforeEach, describe, expect, it, vi } from 'vitest';
const fetchReviews = vi.hoisted(() => vi.fn());
vi.mock('./external/steam-reviews-api.mjs', () => ({ fetchSteamReviews: fetchReviews }));
import { refreshReviewBatch } from '../../scripts/refresh-steam-reviews.mjs';

describe('Steam review maintenance backpressure', () => {
  beforeEach(() => fetchReviews.mockReset().mockResolvedValue({ reviews: [], query_summary: { total_reviews: 0 } }));

  it.each(['57014', 'ECHECKOUTTIMEOUT'])('stops without failure-marker writes or another game after %s', async code => {
    const failure = Object.assign(new Error('Controlled resource exhaustion'), { code });
    const sql = Object.assign(vi.fn().mockResolvedValue([
      { id: 'local-first', steam_app_id: 1 }, { id: 'local-second', steam_app_id: 2 },
    ]), { begin: vi.fn().mockRejectedValue(failure) });
    await expect(refreshReviewBatch(sql, { limit: 2, pauseMs: 0 })).rejects.toBe(failure);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.begin).toHaveBeenCalledTimes(1);
  });

  it.each([
    { reviews: [], query_summary: { total_reviews: 20 } },
    { reviews: [{ review: 'missing an identity' }], query_summary: { total_reviews: 20 } },
  ])('retains the previous review set on an incomplete provider payload', async payload => {
    fetchReviews.mockResolvedValueOnce(payload);
    const sql = Object.assign(vi.fn().mockResolvedValueOnce([{ id: 'local-first', steam_app_id: 1 }]), { begin: vi.fn() });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(await refreshReviewBatch(sql, { pauseMs: 0 })).toMatchObject({ failed: 1, deletedReviews: 0, writtenReviews: 0 });
      expect(sql).toHaveBeenCalledTimes(2); // due read and failure marker only
      expect(sql.begin).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });
});
