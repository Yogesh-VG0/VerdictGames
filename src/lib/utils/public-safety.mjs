// Mature age ratings and content warnings are not adult-only classifications.
// Shared by public responses and provider ingestion.
const explicit = /\b(?:nsfw|hentai|porn(?:ography|ographic)?|erotic(?:a)?|adult[ -]?only|adults[ -]?only|explicit sex(?:ual content)?|sex game|sexual simulation)\b/i;
export function isPublicContentAllowed({ title = '', name = '', tags = [], genres = [], description = '' }) {
  const terms = [...(tags || []), ...(genres || [])].map(value => typeof value === 'string' ? value : value?.name || value?.slug || '');
  return !explicit.test(`${title}\n${name}\n${description || ''}`)
    && !terms.some(value => explicit.test(value) || /^(?:adult|adult content)$/i.test(value.trim()));
}
export function isPublicRawgContentAllowed(item) {
  // RAWG mislabels this exact identity Adults Only. Authoritative ESRB: Mature
  // 17+, https://www.esrb.org/ratings/40077/kingdom-come-deliverance-ii/
  // Correct the rating only; explicit-content checks still apply.
  const verifiedMature=item.id===980502 && item.name==='Kingdom Come: Deliverance II';
  const ageRating=verifiedMature?'mature':item.esrb_rating?.slug || item.esrb_rating?.name || '';
  return !/adults[ -]?only/i.test(ageRating) && isPublicContentAllowed(item);
}
