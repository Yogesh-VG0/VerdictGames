import { describe, expect, it } from 'vitest';
import { preferExistingCover } from '../artwork-policy.mjs';
const cover = 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co8ae0.jpg';
const steam = 'https://cdn.akamai.steamstatic.com/steam/apps/2694490/library_600x900_2x.jpg';
const screenshot = 'https://media.rawg.io/media/screenshots/21f/game.jpg';
describe('portrait preservation during enrichment', () => {
  it('preserves real covers when an upstream fallback is a screenshot', () => {
    expect(preferExistingCover(cover, screenshot)).toBe(true);
    expect(preferExistingCover(steam, screenshot)).toBe(true);
    expect(preferExistingCover(cover, '')).toBe(true);
  });
  it('permits portrait upgrades and does not trust lookalike hosts', () => {
    expect(preferExistingCover(screenshot, steam)).toBe(false);
    expect(preferExistingCover(steam, cover)).toBe(false);
    expect(preferExistingCover('https://images.igdb.com.evil.test/t_cover_big/a.jpg', cover)).toBe(false);
  });
});
