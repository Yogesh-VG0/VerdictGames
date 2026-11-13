import { describe, it, expect } from 'vitest';
import { providerImageLoader, supportsProviderImageLoader } from '../image-loader';

describe('provider-side responsive images', () => {
  it('bounds RAWG images at the provider without stacking resize paths', () => {
    const image = 'https://media.rawg.io/media/games/734/art.jpg';
    expect(supportsProviderImageLoader(image)).toBe(true);
    const resized = providerImageLoader({ src: image, width: 500 });
    expect(resized).toBe('https://media.rawg.io/media/resize/640/-/games/734/art.jpg');
    expect(providerImageLoader({ src: resized, width: 1920 })).toBe('https://media.rawg.io/media/resize/1280/-/games/734/art.jpg');
    expect(supportsProviderImageLoader(image.replace('media.rawg.io', 'media.rawg.io.example.com'))).toBe(false);
  });
  const src = 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co82c5.jpg';
  it('serves smaller WebP covers while retaining retina resolution', () => {
    expect(providerImageLoader({ src, width: 256 })).toContain('/t_cover_big/co82c5.webp');
    expect(providerImageLoader({ src, width: 512 })).toContain('/t_cover_big_2x/co82c5.webp');
  });
  it('sizes landscape artwork separately and leaves other hosts unchanged', () => {
    expect(providerImageLoader({ src: src.replace('t_cover_big_2x', 't_screenshot_big'), width: 500 })).toContain('/t_screenshot_med/');
    const other = src.replace('images.igdb.com', 'example.com');
    expect(supportsProviderImageLoader(other)).toBe(false);
    expect(providerImageLoader({ src: other, width: 500 })).toBe(other);
  });
});
