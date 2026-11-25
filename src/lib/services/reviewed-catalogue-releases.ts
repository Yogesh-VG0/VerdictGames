import type { GameRow } from '@/lib/supabase/types';
import { hasKnownFullRelease, hasUnreleasedStatus } from '@/lib/utils/release-status';
import type { ReleaseTiming } from '@/lib/utils/release-timing';

type ReviewedRelease = {
  slug: string;
  date: string;
  catalogueDate?: string;
  identity: 'igdb_id' | 'rawg_id' | 'steam_app_id';
  providerId: number;
  source?: string;
};

// Publisher or storefront evidence for specific catalogue records. This
// corrects the public rail projection, without changing stored lifecycle data.
export const reviewedCatalogueReleases: ReviewedRelease[] = [
  { slug: 'grand-theft-auto-vi', date: '2026-11-19', identity: 'rawg_id', providerId: 972995, source: 'https://www.rockstargames.com/VI/out-now' },
  { slug: 'hades-ii', date: '2025-09-25', identity: 'steam_app_id', providerId: 1145350, source: 'https://www.supergiantgames.com/blog/hades2-now-available/' },
  { slug: 'slime-rancher-2', date: '2025-09-23', identity: 'steam_app_id', providerId: 1657630, source: 'https://store.steampowered.com/app/1657630' },
  { slug: 'the-rogue-prince-of-persia', date: '2025-08-20', identity: 'steam_app_id', providerId: 2717880, source: 'https://store.steampowered.com/app/2717880/' },
  { slug: 'rift-of-the-necrodancer', date: '2025-02-05', identity: 'steam_app_id', providerId: 2073250, source: 'https://store.steampowered.com/app/2073250/Rift_of_the_NecroDancer/' },
  { slug: 'citizen-sleeper-2-starward-vector', date: '2025-01-31', identity: 'steam_app_id', providerId: 2442460, source: 'https://store.steampowered.com/app/2442460/Citizen_Sleeper_2_Starward_Vector/' },
  { slug: 'sulfur', date: '2026-10-28', identity: 'steam_app_id', providerId: 2124120 },
  { slug: 'phantom-blade-zero', date: '2026-10-29', identity: 'igdb_id', providerId: 250618 },
  { slug: 'reka', date: '2026-10-26', identity: 'steam_app_id', providerId: 1737870 },
  { slug: 'final-fantasy-resonance', date: '2026-10-22', identity: 'igdb_id', providerId: 410844 },
  { slug: 'castlevania-belmonts-curse', date: '2026-10-15', identity: 'steam_app_id', providerId: 4231820 },
  { slug: 'valor-mortis', date: '2026-10-13', identity: 'steam_app_id', providerId: 2828710 },
  { slug: 'clive-barkers-hellraiser-revival', date: '2026-10-08', identity: 'rawg_id', providerId: 1015542 },
  { slug: 'gears-of-war-e-day', date: '2026-10-06', identity: 'steam_app_id', providerId: 3010850 },
  { slug: 'ace-combat-8-wings-of-theve', date: '2026-10-02', identity: 'igdb_id', providerId: 381247 },
  { slug: 'ea-sports-fc-27', date: '2026-09-25', identity: 'steam_app_id', providerId: 4080220 },
  { slug: 'control-resonant', date: '2026-09-24', identity: 'rawg_id', providerId: 1015409 },
  { slug: 'silent-hill-townfall', date: '2026-09-24', catalogueDate: '2026-09-23', identity: 'rawg_id', providerId: 1018062 },
  { slug: 'aniimo', date: '2026-09-16', identity: 'steam_app_id', providerId: 4126040 },
  { slug: 'marvels-wolverine', date: '2026-09-15', identity: 'rawg_id', providerId: 662318 },
  { slug: 'onimusha-way-of-the-sword', date: '2026-09-04', identity: 'rawg_id', providerId: 994600 },
  { slug: 'the-blood-of-dawnwalker', date: '2026-09-03', catalogueDate: '2026-09-02', identity: 'steam_app_id', providerId: 3751260 },
  { slug: 'resonance-a-plague-tale-legacy', date: '2026-08-27', identity: 'steam_app_id', providerId: 2713000 },
  { slug: 'star-wars-zero-company', date: '2026-08-27', identity: 'rawg_id', providerId: 1002691 },
];

type ReleaseIdentity = Pick<GameRow, 'slug' | 'rawg_id' | 'igdb_id' | 'steam_app_id' | 'release_status' | 'release_date'>;

export function matchReviewedCatalogueRelease(row: ReleaseIdentity, candidates = reviewedCatalogueReleases) {
  if (row.release_status && !hasKnownFullRelease(row)) return undefined;
  return candidates.find(game => game.slug === row.slug && row[game.identity] === game.providerId
    && (game.date === row.release_date || Boolean(game.catalogueDate && game.catalogueDate === row.release_date)));
}

export const reviewedPendingCatalogueReleases = [
  { slug:'fable', rawgId:471026, status:'upcoming', timing:{precision:'day',value:'2027-02-23'}, source:'https://www.xbox.com/en-US/games/fable' },
  { slug:'paralives', rawgId:387312, status:'early-access', timing:{precision:'tba'}, source:'https://store.steampowered.com/app/1118520/Paralives/' },
] as const satisfies ReadonlyArray<{slug:string;rawgId:number;status:'upcoming'|'early-access';timing:ReleaseTiming;source:string}>;

export function matchReviewedPendingCatalogueRelease(row: Pick<ReleaseIdentity, 'slug'|'rawg_id'|'release_status'>) {
  if (hasKnownFullRelease(row) || (hasUnreleasedStatus(row) && /^(cancelled|canceled|delisted)$/i.test(row.release_status ?? ''))) return undefined;
  return reviewedPendingCatalogueReleases.find(entry=>entry.slug===row.slug && entry.rawgId===row.rawg_id);
}
