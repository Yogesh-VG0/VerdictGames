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
    .replace(/\s+/g, "-")          // Replace spaces with hyphens
    .replace(/&/g, "-and-")        // Replace & with 'and'
    .replace(/[^\w-]+/g, "")       // Remove all non-word chars (except hyphens)
    .replace(/--+/g, "-")          // Replace multiple hyphens with single
    .replace(/^-+/, "")            // Trim leading hyphens
    .replace(/-+$/, "");           // Trim trailing hyphens
}
