/**
 * Image optimization utilities using Cloudinary
 * 
 * Converts external high-resolution image URLs to optimized Cloudinary URLs
 * for better performance (reduced file size while maintaining quality).
 */

// Support both server-side and client-side usage
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dotbx3fos';

// Image preset configuration type
interface ImagePresetConfig {
  width: number;
  height?: number;
  quality: number;
  format: string;
}

// Image presets for different use cases
export const IMAGE_PRESETS: Record<string, ImagePresetConfig> = {
  // Hero carousel - large but optimized (1920px width, 85% quality)
  hero: {
    width: 1920,
    height: 1080,
    quality: 85,
    format: 'auto',
  },
  // Cover images - smaller (600px width)
  cover: {
    width: 600,
    height: 900,
    quality: 85,
    format: 'auto',
  },
  // Screenshots - medium (1280px width)
  screenshot: {
    width: 1280,
    quality: 85,
    format: 'auto',
  },
};

type ImagePreset = keyof typeof IMAGE_PRESETS;

/**
 * Check if a URL is already a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
}

/**
 * Check if a URL is from a trusted CDN that already optimizes images
 * (IGDB, RAWG, Steam, etc.)
 */
export function isTrustedCdnUrl(url: string): boolean {
  const trustedDomains = [
    'images.igdb.com',
    'media.rawg.io',
    'steamcdn-a.akamaihd.net',
    'cdn.akamai.steamstatic.com',
    'cdn.cloudflare.steamstatic.com',
    'shared.akamai.steamstatic.com',
  ];
  return trustedDomains.some(domain => url.includes(domain));
}

/**
 * Check if a URL needs optimization (external high-res source)
 */
export function needsOptimization(url: string): boolean {
  if (!url || url.trim() === '') return false;
  if (isCloudinaryUrl(url)) return false;
  if (isTrustedCdnUrl(url)) return false;
  return true;
}

/**
 * Build a Cloudinary fetch URL that optimizes an external image
 * 
 * This uses Cloudinary's "fetch" delivery type which:
 * 1. Fetches the image from the external URL
 * 2. Applies transformations (resize, compress, format conversion)
 * 3. Caches and serves through Cloudinary CDN
 * 
 * @param externalUrl - The original external image URL
 * @param preset - Optimization preset to use (hero, cover, screenshot)
 * @returns Cloudinary fetch URL with optimizations applied
 */
export function buildOptimizedUrl(
  externalUrl: string,
  preset: ImagePreset = 'hero'
): string {
  if (!externalUrl || !CLOUDINARY_CLOUD_NAME) {
    return externalUrl;
  }

  // Don't double-optimize
  if (!needsOptimization(externalUrl)) {
    return externalUrl;
  }

  const config = IMAGE_PRESETS[preset];
  
  // Build transformation string
  const transforms: string[] = [];
  
  if (config.width) {
    transforms.push(`w_${config.width}`);
  }
  if (config.height) {
    transforms.push(`h_${config.height}`);
  }
  
  // Crop mode: fill to maintain aspect ratio, focus on faces/important areas
  transforms.push('c_fill');
  transforms.push('g_auto');
  
  // Quality and format
  transforms.push(`q_${config.quality || 'auto:good'}`);
  transforms.push(`f_${config.format || 'auto'}`);
  
  const transformString = transforms.join(',');
  
  // URL-encode the external URL for Cloudinary fetch
  // encodeURIComponent encodes all special chars including /, :, etc.
  const encodedUrl = encodeURIComponent(externalUrl);
  
  // Build the Cloudinary fetch URL
  // Format: https://res.cloudinary.com/{cloud_name}/image/fetch/{transformations}/{encoded_url}
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformString}/${encodedUrl}`;
}

/**
 * Optimize a header image URL for hero carousel use
 */
export function optimizeHeaderImage(url: string): string {
  return buildOptimizedUrl(url, 'hero');
}

/**
 * Optimize a cover image URL
 */
export function optimizeCoverImage(url: string): string {
  return buildOptimizedUrl(url, 'cover');
}

/**
 * Optimize a screenshot URL
 */
export function optimizeScreenshot(url: string): string {
  return buildOptimizedUrl(url, 'screenshot');
}

/**
 * Get image info from a URL (dimensions, format estimate)
 * This is a helper for the admin UI to show expected output
 */
export function getOptimizedImageInfo(url: string, preset: ImagePreset = 'hero') {
  const config = IMAGE_PRESETS[preset];
  const optimizedUrl = buildOptimizedUrl(url, preset);
  const isOptimized = needsOptimization(url);
  
  return {
    originalUrl: url,
    optimizedUrl,
    isOptimized,
    expectedWidth: config.width,
    expectedHeight: config.height || 'auto',
    expectedQuality: config.quality,
    expectedFormat: 'webp/avif (auto)',
  };
}
