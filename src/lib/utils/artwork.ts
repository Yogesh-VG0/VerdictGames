import { isProviderHeroArtwork, selectLandscapeArtwork } from "./artwork-policy.mjs";

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


type ArtworkFields = {
  cover_image?: string | null;
  header_image?: string | null;
  steam_app_id?: number | null;
};

function matchesStoredSteamApp(value: string | null | undefined, appId: number | null | undefined) {
  if (!value) return false;
  const match = /^https:\/\/[^/]*(?:steamstatic\.com|akamaihd\.net)\/(?:store_item_assets\/)?steam\/apps\/(\d+)\//i.exec(value);
  return !match || Number(match[1]) === appId;
}

export function portraitArtwork(row: ArtworkFields | undefined, providerBackground?: string | null) {
  const imageCandidates = [row?.cover_image, row?.header_image].filter(value => matchesStoredSteamApp(value, row?.steam_app_id));
  const portrait = imageCandidates.find(isPortraitArtwork);
  const image = portrait || imageCandidates[0] || providerBackground || null;
  const imageKind: 'cover' | 'artwork' = portrait || isPortraitArtwork(image) ? 'cover' : 'artwork';
  return { image, imageKind };
}

export function selectCatalogueArtwork(row: ArtworkFields | undefined, providerBackground?: string | null) {
  const { image, imageKind } = portraitArtwork(row, providerBackground);
  const cover = row?.cover_image;
  const header = row?.header_image;
  // The catalogue match and RAWG record are already identity-bound by the caller.
  const landscapeHeader = header && matchesStoredSteamApp(header, row?.steam_app_id)
    && header !== cover && !isPortraitArtwork(header) ? header : null;
  const landscapeBackground = providerBackground && !isPortraitArtwork(providerBackground) ? providerBackground : null;
  const landscapeImage = selectLandscapeArtwork({
    existing: landscapeHeader,
    rawg: { background_image: landscapeBackground },
    steamAppId: row?.steam_app_id,
    cover,
  }) || landscapeBackground || image;
  const landscapeImageKind: 'cover' | 'artwork' = landscapeImage && (isPortraitArtwork(landscapeImage)
    || landscapeImage === cover && !isProviderHeroArtwork(landscapeImage)) ? 'cover' : 'artwork';
  return { image, imageKind, landscapeImage, landscapeImageKind };
}

export function catalogueGameHref(game: { slug: string; rawgId: number; catalogueId?: string }) {
  return '/game/' + game.slug + (!game.catalogueId && Number.isSafeInteger(game.rawgId) && game.rawgId > 0
    ? '?rawgId=' + game.rawgId : '');
}
