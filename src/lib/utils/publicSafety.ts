import { isPublicContentAllowed, isPublicRawgContentAllowed } from './public-safety.mjs';
type PublicGame = { title?: string; tags?: string[] | null; genres?: string[] | null; description?: string | null };
/** Mainstream mature games are included; explicit adult-only content is excluded. */
export function isPublicSafeGame(row: PublicGame): boolean { return isPublicContentAllowed(row); }
export function filterPublicSafeGames<T extends PublicGame>(rows: T[]): T[] { return rows.filter(isPublicSafeGame); }
export function isPublicSafeRawgGame(item: {
  id?: number; name?: string; tags?: Array<{ name?: string; slug?: string }> | null;
  genres?: Array<{ name?: string; slug?: string }> | null;
  esrb_rating?: { slug?: string; name?: string } | null;
}): boolean {
  return isPublicRawgContentAllowed(item);
}
