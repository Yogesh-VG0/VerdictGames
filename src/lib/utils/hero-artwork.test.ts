import { describe, expect, it, vi } from 'vitest';
import { igdbHeroImageLoader } from './image-loader';
import { matchedIgdbArtwork, reviewedHeroArtwork, selectLandscapeArtwork, verifiedSteamLibraryHero } from './artwork-policy.mjs';

const igdbUrl = (id: string, variant = '1080p') => `https://images.igdb.com/igdb/image/upload/t_${variant}/${id}.jpg`;
const image = (id: string, width = 1920, height = 1080) => ({ image_id: id, width, height });
const rawg = { background_image: 'https://media.rawg.io/media/games/ab1/background.jpg' };
const steamAppId = 123;
const steam = { steam_appid: steamAppId, type: 'game' };
const steamHeroUrl = 'https://cdn.akamai.steamstatic.com/steam/apps/123/library_hero.jpg';

describe('hero artwork selection', () => {
  it('evaluates every image and prefers crop-friendly artwork over more pixels', () => {
    const artworks = [image('wide', 5000, 2000), image('portrait', 2000, 3000), image('cover'),
      { ...image('transparent'), alpha_channel: true }, { ...image('aaa'), image_type: { name: 'Game Logo' } },
      image('beta'), image('alpha'), image('../unsafe')];
    const game = { cover: image('cover'), artworks, screenshots: [image('screen', 3840, 2160)] };
    expect(selectLandscapeArtwork({ igdb: game, steam, steamAppId, steamHeroUrl, rawg })).toBe(igdbUrl('alpha'));
    expect(selectLandscapeArtwork({ igdb: { ...game, artworks: artworks.toReversed() } })).toBe(igdbUrl('alpha'));
  });

  it('allows Steam to beat marginal promotional art, then prefers verified RAWG to screenshots', () => {
    const igdb = { artworks: [image('marginal', 1280, 720)], screenshots: [image('scene')] };
    expect(selectLandscapeArtwork({ igdb, steam, steamAppId, steamHeroUrl })).toBe(steamHeroUrl);
    expect(selectLandscapeArtwork({ igdb: { screenshots: igdb.screenshots }, rawg })).toBe(rawg.background_image);
    expect(selectLandscapeArtwork({ igdb: { screenshots: igdb.screenshots } })).toBe(igdbUrl('scene', 'screenshot_huge'));
  });

  it('keeps known good and manual assets through failures and inferior candidates', () => {
    const existing = igdbUrl('promotional');
    expect(selectLandscapeArtwork({ existing, rawg })).toBe(existing);
    expect(selectLandscapeArtwork({ existing })).toBe(existing);
    expect(selectLandscapeArtwork({ existing: '/editorial/approved.jpg', rawg })).toBe('/editorial/approved.jpg');
    expect(selectLandscapeArtwork({ existing: igdbUrl('scene', 'screenshot_big'), igdb: { artworks: [image('upgrade')] } })).toBe(igdbUrl('upgrade'));
  });

  it('rejects unbound games and mismatched image hosts or Steam app IDs', () => {
    const wrong = { id: 5, name: 'Example II', first_release_date: Date.UTC(2026, 0) / 1000 };
    expect(matchedIgdbArtwork(wrong, { title: 'Example', releaseDate: '2026-01-01' })).toBeNull();
    expect(matchedIgdbArtwork(wrong, { title: 'Example II', igdbId: 6, releaseDate: '2026-01-01' })).toBeNull();
    expect(matchedIgdbArtwork(wrong, { title: 'Example II', releaseDate: '2026-01-01' })).toBe(wrong);
    expect(selectLandscapeArtwork({ steam, steamAppId, steamHeroUrl: steamHeroUrl.replace('/123/', '/124/'),
      rawg: { background_image: rawg.background_image.replace('media.rawg.io', 'media.rawg.io.evil.test') } })).toBe('');
  });

  it('honors the bound GTA VI override despite inferior ingestion data', () => {
    const identity = { slug: 'grand-theft-auto-vi', igdbId: 52189, rawgId: 972995 };
    const reviewed = reviewedHeroArtwork(identity);
    expect(reviewed?.credit).toContain('IGDB');
    expect(reviewedHeroArtwork({ ...identity, igdbId: 1 })).toBeNull();
    expect(reviewedHeroArtwork({ slug: 'schedule-i' })).toBeNull();
    expect(selectLandscapeArtwork({ reviewed, igdb: { screenshots: [image('scene', 3840, 2160)] }, rawg })).toBe(igdbUrl('ar6i4p'));
  });

  it('makes at most one bounded Steam CDN check and rejects missing or non-image replies', async () => {
    const probe = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { headers: { 'content-type': 'image/jpeg' } }));
    expect(await verifiedSteamLibraryHero({ steam, steamAppId, igdb: { artworks: [image('good')] } }, probe)).toBeNull();
    expect(await verifiedSteamLibraryHero({ steam, steamAppId: 999 }, probe)).toBeNull();
    expect(probe).not.toHaveBeenCalled();
    expect(await verifiedSteamLibraryHero({ steam, steamAppId }, probe)).toBe(steamHeroUrl);
    expect(probe).toHaveBeenCalledExactlyOnceWith(steamHeroUrl, expect.objectContaining({ method: 'HEAD', redirect: 'error' }));
    probe.mockResolvedValueOnce(new Response(null, { headers: { 'content-type': 'text/html' } }));
    expect(await verifiedSteamLibraryHero({ steam, steamAppId }, probe)).toBeNull();
  });

  it('uses fit variants and caps metadata-limited assets at 720p', () => {
    expect(igdbHeroImageLoader({ src: igdbUrl('large'), width: 828 })).toContain('/t_720p/large.webp');
    expect(igdbHeroImageLoader({ src: igdbUrl('large'), width: 1920 })).toContain('/t_1080p/large.webp');
    expect(igdbHeroImageLoader({ src: igdbUrl('small', '720p'), width: 1920 })).toContain('/t_720p/small.webp');
  });
});
