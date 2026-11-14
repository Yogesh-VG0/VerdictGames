import { describe, expect, it } from 'vitest';
import { parseSchedulerMetadata } from './scheduler-metadata';
describe('maintenance metadata compatibility', () => {
  it('recognizes deferrals in both current and historical records', () => {
    const metadata = { outcome: 'deferred', provider: 'rawg' };
    expect(parseSchedulerMetadata(metadata)).toEqual(metadata);
    expect(parseSchedulerMetadata(JSON.stringify(metadata))).toEqual(metadata);
  });
  it.each([null, undefined, 2, [], 'not json', 'null'])('rejects malformed metadata %s', value => {
    expect(parseSchedulerMetadata(value)).toBeNull();
  });
});
