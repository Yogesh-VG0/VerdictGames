import { describe, expect, it, vi } from 'vitest';
import { buildSteamReviewsUrl, fetchSteamReviews } from './steam-reviews-api.mjs';

describe('Valve review API migration', () => {
  it('encodes enum filters and unwraps the new response without a success field', async () => {
    const url = new URL(buildSteamReviewsUrl(1145360, { languages: ['all'], limit: 1 }));
    expect(url.pathname).toBe('/IUserReviewsService/GetAppReviews/v1/');
    expect(JSON.parse(url.searchParams.get('input_json')!)).toMatchObject({ appid: 1145360, languages: ['all'], purchase_type: 1, review_type: 0 });
    const payload = { query_summary: { total_reviews: 100 }, reviews: [] };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ response: payload }));
    expect(await fetchSteamReviews(1145360, {}, fetcher)).toEqual(payload);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });
  it('rejects HTML success pages and upstream failures', async () => {
    await expect(fetchSteamReviews(1145360, {}, vi.fn().mockResolvedValue(new Response('<!DOCTYPE html>', { headers: { 'content-type': 'text/html' } })))).rejects.toThrow('non-JSON');
    await expect(fetchSteamReviews(1145360, {}, vi.fn().mockResolvedValue(new Response('', { status: 429 })))).rejects.toThrow('HTTP 429');
  });
});
