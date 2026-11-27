import { unstable_cache } from 'next/cache';
import { getIgdbReleaseDates } from '@/lib/external/igdb';
import { boundedHomepageRead } from '@/lib/services/homepage-budget';
import { normalizeTitle } from '@/lib/utils/slugify';
import { selectIgdbTiming, type ReleaseTiming } from '@/lib/utils/release-timing';
export { getReviewedReleaseTiming } from '@/lib/utils/reviewed-release-timing';

type Identity = { title: string; igdbId?: number | null };

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
