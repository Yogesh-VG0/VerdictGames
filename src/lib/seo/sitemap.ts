import type { MetadataRoute } from 'next';

export async function collectSitemapRows<T extends { id: string }>(
  fetchPage: (after: string | undefined, size: number) => Promise<T[]>,
  pageSize = 250,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Invalid sitemap batch size');
  const result: T[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await fetchPage(after, pageSize);
    // Fail rather than loop indefinitely or silently omit rows if a provider
    // stops respecting the stable, ascending primary-key cursor.
    let previous = after;
    for (const row of page) {
      if (!row.id || (previous !== undefined && row.id <= previous)) throw new Error('Sitemap cursor did not advance');
      previous = row.id;
    }
    result.push(...page);
    if (page.length < pageSize) return result;
    after = previous;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}

export function serializeSitemap(pages: MetadataRoute.Sitemap): string {
  const urls = pages.map(page => {
    const date = page.lastModified ? new Date(page.lastModified).toISOString() : undefined;
    return '<url>' + `<loc>${escapeXml(page.url)}</loc>`
      + (date ? `<lastmod>${date}</lastmod>` : '')
      + (page.changeFrequency ? `<changefreq>${page.changeFrequency}</changefreq>` : '')
      + (page.priority !== undefined ? `<priority>${page.priority}</priority>` : '') + '</url>';
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + urls.join('') + '</urlset>';
}
