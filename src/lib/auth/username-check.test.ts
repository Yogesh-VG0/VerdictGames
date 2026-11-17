import { describe, expect, it, vi } from 'vitest';
import { createUsernameChecker } from './username-check';
describe('username request hints', () => {
  it('deduplicates pending checks and reuses a recent result', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, data: { available: true } }));
    const check = createUsernameChecker(fetcher);
    await Promise.all([check('Player_1'), check('player_1')]);
    await check('player_1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not cache errors or interpret an HTTP failure as taken or available', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'offline' }, { status: 503 }));
    const check = createUsernameChecker(fetcher);
    await expect(check('player_1')).rejects.toThrow('Temporarily');
    fetcher.mockResolvedValue(Response.json({ success: true, data: { available: false, reason: 'Taken' } }));
    expect((await check('player_1')).available).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not query invalid or reserved input', async () => {
    const fetcher = vi.fn();
    expect((await createUsernameChecker(fetcher)('admin')).available).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
