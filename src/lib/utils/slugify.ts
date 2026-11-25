/**
 * VERDICT.GAMES — Slug Utility
 *
 * Generates URL-safe slugs from game titles.
 * Rules: lowercase, replace spaces with hyphens, strip special chars.
 */

export { slugify } from "./slug-format.mjs";

/** Strips all non-alphanumeric chars for fuzzy title comparison. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Checks if two titles match after normalization. */
export function titlesMatch(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}
