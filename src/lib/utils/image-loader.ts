import type { ImageLoaderProps } from 'next/image';

export function supportsProviderImageLoader(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === 'images.igdb.com'
      && /^\/igdb\/image\/upload\/t_[a-z0-9_]+\/[a-z0-9]+\.(jpg|png|webp)$/i.test(url.pathname);
  } catch { return false; }
}

// Resize on the existing image provider's CDN instead of spending Vercel
// function CPU on thousands of catalog image transformations.
export function providerImageLoader({ src, width }: ImageLoaderProps): string {
  if (!supportsProviderImageLoader(src)) return src;
  const url = new URL(src);
  const isCover = url.pathname.includes('/t_cover_');
  const size = isCover
    ? (width <= 264 ? 'cover_big' : 'cover_big_2x')
    : width <= 569 ? 'screenshot_med' : width <= 889 ? 'screenshot_big' : width <= 1280 ? 'screenshot_huge' : '1080p';
  url.pathname = url.pathname.replace(/\/t_[a-z0-9_]+\//i, `/t_${size}/`).replace(/\.(jpg|png|webp)$/i, '.webp');
  return url.toString();
}
