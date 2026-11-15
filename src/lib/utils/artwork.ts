export function artworkTitleKey(title: string): string {
  return title.toLowerCase().replace(/\s+\(archetype entertainment\)$/i, '').normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

/** URL shape is evidence of asset type, never proof of rights or pixel quality. */
export function isPortraitArtwork(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (
      parsed.hostname === 'images.igdb.com' && /\/t_cover_[a-z0-9_]+\//.test(parsed.pathname)
      || /(^|\.)(steamstatic\.com|akamaihd\.net)$/.test(parsed.hostname) && /\/(library_600x900(?:_2x)?|portrait)\./.test(parsed.pathname)
    );
  } catch { return false; }
}

export interface PortraitCandidate { name: string; slug?: string; aliases: string[]; year?: number | null; companies?: string[]; image: string }
export function matchPortrait(game: { name: string; slug: string; released: string | null }, candidates: PortraitCandidate[]): string | null {
  const key = artworkTitleKey(game.name);
  const year = game.released ? Number(game.released.slice(0, 4)) : null;
  const matches = candidates.filter(candidate => [candidate.name, ...candidate.aliases].some(name => artworkTitleKey(name) === key)
    && (!year || !candidate.year || Math.abs(year - candidate.year) <= 1)
    && (!/archetype entertainment/i.test(game.name) || candidate.companies?.some(name => /archetype/i.test(name))));
  const bySlug = matches.filter(candidate => candidate.slug === game.slug);
  // Same-name releases and editions are ambiguous without a provider identity.
  return bySlug.length === 1 ? bySlug[0].image : matches.length === 1 ? matches[0].image : null;
}
