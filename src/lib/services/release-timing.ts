import { unstable_cache } from 'next/cache';
import { getIgdbReleaseDates } from '@/lib/external/igdb';
import { boundedHomepageRead } from '@/lib/services/homepage-budget';
import { normalizeTitle } from '@/lib/utils/slugify';
import { selectIgdbTiming, type ReleaseTiming } from '@/lib/utils/release-timing';

type Identity = { title: string; igdbId?: number | null };

// Preserve the previously reviewed publisher windows when provider precision is absent.
const reviewedWindows = new Map([[391403, '2026-12'], [973539, '2027-03'], [1015421, '2027-02'], [469645, '2027-01']]);

export function getReviewedReleaseTiming(rawgId: number | null | undefined, date?: string | null, providerTiming?: ReleaseTiming): ReleaseTiming | undefined {
  // Catalyst, separate from Legacy of Atlantis. Embracer's 2026-11-11
  // schedule supersedes the 2025 reveal window, at calendar-year precision.
  // https://embracer.com/wp-content/uploads/2026/11/Q2-FY-2627-Presentation.pdf#page=9
  if (rawgId === 1015411) return { precision: 'year', value: '2028' };
  if (providerTiming) return providerTiming;
  const month = rawgId ? reviewedWindows.get(rawgId) : undefined;
  if (month && (!date || date.startsWith(month) || date < month)) return { precision: 'month', value: month };
}

const readDates = unstable_cache((names: string[], ids: number[]) => getIgdbReleaseDates(names, ids),
  ['igdb-release-precision-v1'], { revalidate: 3600 });

export async function readReleaseTimings(games: Identity[]) {
  if (!games.length || !process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return () => undefined;
  const names = [...new Set(games.filter(game => !game.igdbId).map(game => game.title))].sort().slice(0, 100);
  const ids = [...new Set(games.flatMap(game => game.igdbId ? [game.igdbId] : []))].sort((a, b) => a - b).slice(0, 100);
  const rows = await boundedHomepageRead(1000, () => readDates(names, ids)).catch(() => []);
  return (game: Identity, date?: string | null): ReleaseTiming | undefined => {
    const matches = rows.filter(row => game.igdbId ? row.id === game.igdbId : normalizeTitle(row.name) === normalizeTitle(game.title));
    if (matches.length !== 1) return undefined;
    return selectIgdbTiming(matches[0].release_dates ?? [], date);
  };
}

export { selectIgdbTiming };
