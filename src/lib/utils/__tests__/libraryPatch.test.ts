import { describe, expect, it } from 'vitest';
import { buildLibraryPatch } from '../libraryPatch';

describe('library edits', () => {
  it('omits private fields when changing only status', () => {
    expect(buildLibraryPatch({ gameId: 'ignored', status: 'completed' })).toEqual({ status: 'completed' });
  });
  it('allows deliberate clearing and zero values', () => {
    expect(buildLibraryPatch({ notes: '', personalRating: null, hoursPlayed: 0, startedAt: null }))
      .toEqual({ notes: '', personal_rating: null, hours_played: 0, started_at: null });
  });
  it.each([{ notes: {} }, { notes: 'x'.repeat(5001) }, { hoursPlayed: -1 }, { hoursPlayed: Infinity }, { personalRating: 101 }, { status: 'admin' }, { startedAt: 'yesterday' }])('rejects invalid input %o', body => {
    expect(() => buildLibraryPatch(body)).toThrow();
  });
});
