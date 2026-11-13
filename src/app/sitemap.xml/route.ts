import { connection } from 'next/server';
import { loadSitemap } from '@/lib/services/sitemap';
import { serializeSitemap } from '@/lib/seo/sitemap';

export const maxDuration = 60;

export async function GET() {
  // Do not query the live catalog during next build. Successful XML is cached
  // at the CDN for an hour; stale copies remain usable during backend errors.
  await connection();
  try {
    const pages = await loadSitemap();
    return new Response(serializeSitemap(pages), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400',
      },
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNAVAILABLE';
    console.warn('[Sitemap] Catalog unavailable', { code });
    return new Response('Sitemap temporarily unavailable. Please retry.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
