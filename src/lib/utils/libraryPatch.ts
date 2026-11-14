import type { UserGameRow } from '@/lib/supabase/types';

type LibraryPatch = Partial<Pick<UserGameRow, 'status' | 'personal_rating' | 'hours_played' | 'notes' | 'started_at' | 'completed_at'>>;

/** Omitted fields remain omitted, so changing status cannot erase private data. */
export function buildLibraryPatch(body: Record<string, unknown>): LibraryPatch {
  const patch: LibraryPatch = {};
  if ('status' in body) {
    if (!['wishlist', 'playing', 'completed', 'dropped', 'paused'].includes(String(body.status))) throw new Error('Invalid status');
    patch.status = body.status as UserGameRow['status'];
  }
  if ('notes' in body) {
    if (typeof body.notes !== 'string' || body.notes.length > 5000) throw new Error('notes must be text of 5,000 characters or less');
    patch.notes = body.notes;
  }
  if ('personalRating' in body) {
    const value = body.personalRating;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Invalid personal rating');
    patch.personal_rating = value as number | null;
  }
  if ('hoursPlayed' in body) {
    const value = body.hoursPlayed;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) throw new Error('Invalid hours played');
    patch.hours_played = value;
  }
  for (const [input, column] of [['startedAt', 'started_at'], ['completedAt', 'completed_at']] as const) {
    if (!(input in body)) continue;
    const value = body[input];
    if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) throw new Error('Invalid library date');
    patch[column] = value as string | null;
  }
  return patch;
}
