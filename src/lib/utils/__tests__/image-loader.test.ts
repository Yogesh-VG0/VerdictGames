import { describe, it, expect } from 'vitest';
import { providerImageLoader, supportsProviderImageLoader } from '../image-loader';

describe('provider-side responsive images', () => {
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
