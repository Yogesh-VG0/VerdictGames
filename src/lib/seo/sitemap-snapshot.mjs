import { GAME_DETAIL_SLUG_REDIRECTS } from '../utils/game-slug-redirects.mjs';
import { isPublicContentAllowed } from '../utils/public-safety.mjs';
import { slugify } from '../utils/slug-format.mjs';

export const SITEMAP_SNAPSHOT_KEY = 'seo:sitemap:published:v1';
export const SITEMAP_CHECKPOINT_KEY = 'seo:sitemap:checkpoint:v1';
export const SITEMAP_PAGE_SIZE = 200;
export const SITEMAP_REFRESH_MS = 7 * 86400_000;
export const SITEMAP_MAX_AGE_MS = 30 * 86400_000;
export const SITEMAP_MAX_PATHS = 49_950;
// Keep the persisted read comfortably below the Next.js data-cache entry cap.
export const SITEMAP_MAX_SNAPSHOT_BYTES = 1_800_000;
export const SITEMAP_TABLES = ['games', 'lists', 'profiles'];

const slugPattern = /^[a-z0-9-]{1,100}$/i;
const listPattern = /^[a-z0-9_-]{1,150}$/i;
const developerPattern = /^[a-z0-9_-]{1,150}$/;
const usernamePattern = /^[a-z0-9_-]{1,50}$/i;

export function sitemapRowPaths(table, row) {
  if (table === 'lists') return listPattern.test(row.slug || '') ? ['/lists/' + row.slug] : [];
  if (table === 'profiles') return usernamePattern.test(row.username || '') ? ['/profile/' + row.username] : [];
  if (!row.title || !slugPattern.test(row.slug || '') || Object.hasOwn(GAME_DETAIL_SLUG_REDIRECTS, row.slug)
    || row.unsafe_description || !isPublicContentAllowed(row)) return [];
  const paths = ['/game/' + row.slug];
  const developer = slugify(row.developer || '');
  if (row.has_art && developerPattern.test(developer)) paths.push('/developers/' + developer);
  return paths;
}

function isCanonicalPath(path) {
  if (typeof path !== 'string') return false;
  const [, section, slug, extra] = path.split('/');
  if (!path.startsWith('/') || !slug || extra !== undefined) return false;
  if (section === 'game') return slugPattern.test(slug) && !Object.hasOwn(GAME_DETAIL_SLUG_REDIRECTS, slug);
  if (section === 'lists') return listPattern.test(slug);
  if (section === 'profile') return usernamePattern.test(slug);
  return section === 'developers' && developerPattern.test(slug);
}

export function isCompleteSitemapSnapshot(value) {
  return value?.version === 1 && value.complete === true && Array.isArray(value.paths)
    && value.paths.length > 0 && value.paths.length <= SITEMAP_MAX_PATHS
    && value.count === value.paths.length && new Set(value.paths).size === value.paths.length
    && value.paths.some(path => typeof path === 'string' && path.startsWith('/game/'))
    && value.paths.every(isCanonicalPath);
}
