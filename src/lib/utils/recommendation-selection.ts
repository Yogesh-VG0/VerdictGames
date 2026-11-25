import { getDiscoveryCanonicalTitle } from '@/lib/utils/discovery';
import { normalizeTitle } from '@/lib/utils/slugify';

type Identity = { title: string; franchise?: string | null };
type Candidate = Identity & { id: string; genres?: string[] | null };

const variantSuffix = /(?:\s*[:–—]\s*|\s+-\s+)(?:update|remastered|remaster|hd|enhanced edition)$/i;
const subtitleSuffix = /(?:\s*[:–—]\s*|\s+-\s+).*$/;
const numberedSuffix = /\s+(?:[1-9]\d?|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;

export function recommendationVariantBase(title: string): string | undefined {
  const base = title.replace(variantSuffix, '');
  return base === title ? undefined : getDiscoveryCanonicalTitle(base);
}

export function removeRecommendationVariants<T extends Identity>(rows: T[]): T[] {
  const baseTitles = new Set(rows.filter(row => !recommendationVariantBase(row.title)).map(row => getDiscoveryCanonicalTitle(row.title)));
  const variants = new Set<string>();
  return rows.filter(row => {
    const base = recommendationVariantBase(row.title);
    if (!base) return true;
    if (baseTitles.has(base) || variants.has(base)) return false;
    variants.add(base);
    return true;
  });
}

export function diversifyRecommendations<T extends Candidate>(
  candidates: T[], limit: number, score: (row: T) => number, releaseYear: (row: T) => number,
): T[] {
  const remaining = candidates.map(row => ({
    row,
    score: score(row),
    // A sequel without franchise metadata can still share a title stem.
    stem: normalizeTitle(row.title.replace(subtitleSuffix, '').replace(numberedSuffix, '')),
    franchise: normalizeTitle(row.franchise ?? ''),
    genres: [...new Set((row.genres ?? []).map(genre => genre.toLowerCase()))],
    era: Math.floor(releaseYear(row) / 5),
  }));
  const counts = new Map<string, number>();
  const getCount = (key: string) => counts.get(key) ?? 0;
  const picks: T[] = [];

  while (remaining.length && picks.length < limit) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (const [index, item] of remaining.entries()) {
      const familyCount = Math.max(item.stem ? getCount('title:' + item.stem) : 0,
        item.franchise ? getCount('franchise:' + item.franchise) : 0);
      const genreCount = item.genres.length ? Math.min(...item.genres.map(genre => getCount('genre:' + genre))) : 0;
      const adjusted = item.score - 8 * familyCount * familyCount
        - Math.min(genreCount * 2, 12) - Math.min(getCount('era:' + item.era), 6);
      if (adjusted > bestScore) {
        bestIndex = index;
        bestScore = adjusted;
      }
    }
    const [item] = remaining.splice(bestIndex, 1);
    picks.push(item.row);
    const keys = [
      ...(item.stem ? ['title:' + item.stem] : []),
      ...(item.franchise ? ['franchise:' + item.franchise] : []),
      ...item.genres.map(genre => 'genre:' + genre),
      ...(item.era ? ['era:' + item.era] : []),
    ];
    for (const key of keys) counts.set(key, getCount(key) + 1);
  }
  return picks;
}
