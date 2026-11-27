import { isPublicContentAllowed } from '../utils/public-safety.mjs';

export const developerDirectoryKey = 'catalogue:developers:aliases:v1';
export const developerDirectoryMaxAge = 60 * 60_000;
const maxSlugs = 20_000;
const maxAliases = 20_000;
const maxNameLength = 1_000;
const slugPattern = /^[a-z0-9_-]{1,150}$/;

export function buildDeveloperDirectory(orderedGameRows, generatedAt, slugify) {
  const entries = new Map();
  for (const row of orderedGameRows) {
    if (typeof row.developer !== 'string' || !row.developer || !row.cover_image || !isPublicContentAllowed(row)) continue;
    const slug = slugify(row.developer);
    if (!slugPattern.test(slug)) continue;
    if (!entries.has(slug)) entries.set(slug, new Set());
    entries.get(slug).add(row.developer);
  }
  // Alias order is inherited from the trusted source's ordered name projection.
  const groups = Object.fromEntries([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([slug, names]) => [slug, [...names]]));
  return { version: 1, complete: true, generatedAt, count: entries.size, groups };
}

export function isDeveloperDirectory(value, slugify, now = Date.now()) {
  if (!value || value.version !== 1 || value.complete !== true || !Number.isSafeInteger(value.generatedAt)) return false;
  const age = now - value.generatedAt;
  if (age < 0 || age >= developerDirectoryMaxAge || !value.groups
    || typeof value.groups !== 'object' || Array.isArray(value.groups)) return false;
  const entries = Object.entries(value.groups);
  if (!entries.length || entries.length > maxSlugs || entries.length !== value.count) return false;
  let aliasCount = 0;
  for (const [slug, names] of entries) {
    if (!slugPattern.test(slug) || !Array.isArray(names) || !names.length || !names.every(
      name => typeof name === 'string' && name.length <= maxNameLength && slugify(name) === slug,
    ) || new Set(names).size !== names.length) return false;
    aliasCount += names.length;
    if (aliasCount > maxAliases) return false;
  }
  return true;
}
