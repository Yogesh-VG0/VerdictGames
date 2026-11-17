import { expect, it } from 'vitest';
import { hasEarlyAccessSignal } from '../release-status';
it('recognizes real legacy Early Access tags without inventing a full release date', () => {
  expect(hasEarlyAccessSignal({ release_status:null,tags:['Action RPG','Early Access'] })).toBe(true);
  expect(hasEarlyAccessSignal({ release_status:'early_access' })).toBe(true);
  expect(hasEarlyAccessSignal({ tags:['RPG'] })).toBe(false);
});
