import { describe, expect, it } from 'vitest';
import { diversifyRecommendations, removeRecommendationVariants } from './recommendation-selection';

const row = (title: string, quality: number, genre = 'Shooter', year = 2004) =>
  ({ id: title, title, genres: [genre], quality, year });
const select = (rows: ReturnType<typeof row>[], limit = 20) =>
  diversifyRecommendations(removeRecommendationVariants(rows), limit, game => game.quality, game => game.year);

describe('recommendation selection', () => {
  it('prefers independent identities and spreads the 20 picks across franchises, genres, and release years', () => {
    const family = ['Half-Life', 'Half-Life 2', 'Half-Life 2: Update', 'Half-Life 2: Episode One',
      'Half-Life 2: Episode Two', 'Half-Life: Alyx'].map((title, index) => row(title, 100 - index));
    const other = Array.from({ length: 24 }, (_, index) => row('Independent ' + String.fromCharCode(65 + index),
      93 - index / 3, ['RPG', 'Puzzle', 'Strategy', 'Adventure'][index % 4], 1998 + index));
    const titles = select([...family, ...other]).map(game => game.title);
    expect(titles).toHaveLength(20);
    expect(titles).toContain('Half-Life 2');
    expect(titles).not.toContain('Half-Life 2: Update');
    expect(titles.filter(title => title.startsWith('Half-Life')).length).toBeLessThan(4);
    expect(select([...family, ...other]).map(game => game.year).filter(year => year < 2005).length).toBeGreaterThan(1);
  });

  it('refills from a narrow eligible pool while retaining substantive sequels', () => {
    const entries = Array.from({ length: 20 }, (_, index) => row(`Series ${index + 1}`, 96 - index));
    expect(select([...entries, row('Series 2: Update', 100)])).toHaveLength(20);
    expect(select([...entries, row('Series 2: Update', 100)]).map(game => game.title)).not.toContain('Series 2: Update');
  });
});
