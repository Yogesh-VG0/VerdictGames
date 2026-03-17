/**
 * VERDICT.GAMES — Slug Utility
 *
 * Generates URL-safe slugs from game titles.
 * Rules: lowercase, replace spaces with hyphens, strip special chars.
 */

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/** Strips all non-alphanumeric chars for fuzzy title comparison. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Checks if two titles match after normalization. */
export function titlesMatch(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}
