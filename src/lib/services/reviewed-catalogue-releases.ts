import type { GameRow } from '@/lib/supabase/types';
import { hasKnownFullRelease } from '@/lib/utils/release-status';

type ReviewedRelease = {
  slug: string;
  date: string;
  catalogueDate?: string;
  identity: 'igdb_id' | 'rawg_id' | 'steam_app_id';
  providerId: number;
};

// Publisher or storefront evidence for specific catalogue records. This
// corrects the public rail projection, without changing stored lifecycle data.
export const reviewedCatalogueReleases: ReviewedRelease[] = [
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

export function matchReviewedCatalogueRelease(row: GameRow, candidates = reviewedCatalogueReleases) {
  if (row.release_status && !hasKnownFullRelease(row)) return undefined;
  return candidates.find(game => game.slug === row.slug && row[game.identity] === game.providerId
    && (game.date === row.release_date || Boolean(game.catalogueDate && game.catalogueDate === row.release_date)));
}
