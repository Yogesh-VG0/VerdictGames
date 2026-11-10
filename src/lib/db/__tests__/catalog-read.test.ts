import { describe, expect, it, vi } from 'vitest';
import { retryCatalogRead } from '../catalog-read';

describe('catalog read resilience', () => {
  it('recovers from a transient statement cancellation', async () => {
    const read = vi.fn().mockRejectedValueOnce({ code: '57014' }).mockResolvedValueOnce(['game']);
    expect(await retryCatalogRead(read)).toEqual(['game']);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('does not hide or repeatedly retry persistent cancellation', async () => {
    const error = { code: '57014' };
    const read = vi.fn().mockRejectedValue(error);
    await expect(retryCatalogRead(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('immediately propagates configuration and authorization errors', async () => {
    const error = { code: '42501' };
    const read = vi.fn().mockRejectedValue(error);
    await expect(retryCatalogRead(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
