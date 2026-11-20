export function portraitPriority(url: string | null | undefined): number;
type Identity = { slug: string; igdbId?: number | null; rawgId?: number | null };
type ReviewedArtwork = Readonly<{ url: string; fallbackUrl?: string; credit: string; sourceUrl: string }>;
type SteamArtwork = { steam_appid: number; type: string; screenshots?: { path_full: string }[] };
type ArtworkInput = {
  igdb?: unknown; steam?: SteamArtwork | null; steamAppId?: number | null;
  existing?: string | null; reviewed?: ReviewedArtwork | null;
  rawg?: { background_image?: string | null; background_image_additional?: string | null } | null;
  rawgScreenshots?: string[]; steamHeroUrl?: string | null; cover?: string | null;
};
export function reviewedHeroArtwork(identity: Identity): ReviewedArtwork | null;
export function matchedIgdbArtwork<T>(game: T | null, identity: {
  igdbId?: number | null; steamAppId?: number | null; title: string; releaseDate?: string | null;
}): T | null;
export function isProviderHeroArtwork(url: string | null | undefined): boolean;
export function steamLibraryHeroAsset(item: unknown, appId: number): string | null;
export function selectLandscapeArtwork(input: ArtworkInput): string;
export function verifiedSteamLibraryHero(input: ArtworkInput, fetchImage?: typeof fetch): Promise<string | null>;
export function preferExistingCover(existing: string | null | undefined, incoming: string | null | undefined): boolean;
