import type { GameRow } from "@/lib/supabase/types";
import { getEvidenceReviewCount, hasStrongCriticEvidence } from "@/lib/utils/quality";
import { hasBrowseTrendingSignal } from "@/lib/utils/trending";
import {isPublicSafeRawgGame} from './publicSafety';
import type {RawgListItem} from '@/lib/external/rawg';
import type {Game} from '@/lib/types';
import { hasKnownFullRelease, hasUnreleasedStatus } from './release-status';
import { isProviderHeroArtwork, reviewedHeroArtwork } from './artwork-policy.mjs';

export function hasWideHeroArtwork(row: GameRow): boolean {
  return Boolean(reviewedHeroArtwork({ slug: row.slug, igdbId: row.igdb_id, rawgId: row.rawg_id })
    || row.header_image !== row.cover_image && isProviderHeroArtwork(row.header_image, row.steam_app_id ?? 0));
}

const HERO_ACTIVITY_WINDOW_MS = 72 * 60 * 60 * 1000;

export function hasRecentHeroActivity(row: Pick<GameRow, 'players_updated_at'>, now = Date.now()) {
  const age = now - Date.parse(row.players_updated_at ?? '');
  return age >= 0 && age <= HERO_ACTIVITY_WINDOW_MS;
}

export function getHeroSummary(game:Game):string {
  const description=game.description?.trim();
  const staleEarlyAccessLead = game.releaseStatus === 'early-access' && /\bis an upcoming\b/i.test(description?.slice(0, 120) ?? '');
  if(description && description.length>20 && !staleEarlyAccessLead && !/is an exceptional|is a solid|has moments of brilliance|struggles to deliver/i.test(description)) {
    return description.slice(0,200)+(description.length>200?'…':'');
  }
  if (game.releaseStatus === 'early-access') return 'Available in Early Access. The full release is still ahead.';
  if(game.isProvisional || game.verdictLabel==='COMING SOON') {
    return 'Explore the announced platforms, trailers and release details.';
  }
  if(game.verdictLabel==='JUST RELEASED')return 'Just released. A Verdict will appear when enough review data is available.';
  return game.verdictSummary;
}

export function selectHeroDiscoveryCandidates(items:RawgListItem[],day:string) {
  const midnight=Date.parse(`${day}T00:00:00Z`);const seen=new Set<number>();
  const ranked = items.filter(item=>{
    const release=Date.parse(`${item.released}T00:00:00Z`);
    if(!isPublicSafeRawgGame(item) || item.added<100 || !item.background_image
      || item.tba || item.released?.endsWith('-12-31')
      || !Number.isFinite(release) || release<midnight-14*86400000 || release>midnight+90*86400000 || seen.has(item.id))return false;
    seen.add(item.id);return true;
  }).sort((a,b)=>b.added-a.added || a.slug.localeCompare(b.slug));
  return [
    ...ranked.filter(item => item.released! <= day).slice(0, 2),
    ...ranked.filter(item => item.released! > day).slice(0, 2),
  ];
}

function getHomepageHeroAgeDays(row: Pick<GameRow, "release_date">): number {
  if (!row.release_date) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(`${row.release_date}T00:00:00`).getTime()) / 86400000;
}

function isHomepageHeroManualCandidate(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const activityIsRecent = hasRecentHeroActivity(row);
  const currentPlayers = activityIsRecent ? row.current_players ?? 0 : 0;
  const momentum = activityIsRecent ? row.momentum ?? 0 : 0;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getHomepageHeroAgeDays(row);

  if (!row.release_date || verdictScore < 80) {
    return false;
  }

  if (currentPlayers < 2000 && !(ageDays <= 120 && verdictScore >= 85 && hasStrongCriticEvidence(row) && evidenceReviewCount >= 1000)) {
    return false;
  }

  if (ageDays <= 120) {
    return hasStrongCriticEvidence(row)
      || evidenceReviewCount >= 10000
      || momentum >= 0.04;
  }

  if (ageDays <= 240) {
    return (hasStrongCriticEvidence(row) && verdictScore >= 84)
      || evidenceReviewCount >= 25000
      || currentPlayers >= 4000
      || momentum >= 0.03;
  }

  return (hasStrongCriticEvidence(row) && verdictScore >= 86 && currentPlayers >= 3000)
    || evidenceReviewCount >= 75000
    || currentPlayers >= 8000
    || (currentPlayers >= 5000 && momentum >= 0.03);
}

export function isHomepageHeroAutoCandidate(row: GameRow): boolean {
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const activityIsRecent = hasRecentHeroActivity(row);
  const currentPlayers = activityIsRecent ? row.current_players ?? 0 : 0;
  const momentum = activityIsRecent ? row.momentum ?? 0 : 0;
  const verdictScore = row.verdict_score ?? row.score ?? 0;
  const ageDays = getHomepageHeroAgeDays(row);

  if (!row.header_image || row.header_image === row.cover_image || !row.release_date || ageDays < 0
    || hasUnreleasedStatus(row) || (row.is_provisional && !hasKnownFullRelease(row)) || verdictScore < 80) {
    return false;
  }

  if (ageDays > 365 && !hasRecentHeroActivity(row) &&
    !(verdictScore >= 90 && hasStrongCriticEvidence(row) && evidenceReviewCount >= 50000)) return false;

  if (row.is_featured_manual && isHomepageHeroManualCandidate(row)) return true;

  if (ageDays >= 0 && ageDays <= 120 && row.header_image && verdictScore >= 85 && hasStrongCriticEvidence(row) && evidenceReviewCount >= 1000) return true;
  if (currentPlayers < 2000) {
    return false;
  }

  if (hasStrongCriticEvidence(row)) {
    return (ageDays <= 120 && verdictScore >= 82 && (evidenceReviewCount >= 10000 || momentum >= 0.04))
      || (ageDays <= 180 && verdictScore >= 84 && (momentum >= 0.03 || evidenceReviewCount >= 15000))
      || (ageDays <= 270 && verdictScore >= 85 && currentPlayers >= 3000 && evidenceReviewCount >= 20000)
      || (ageDays <= 365 && verdictScore >= 86 && currentPlayers >= 5000 && evidenceReviewCount >= 25000);
  }

  return (evidenceReviewCount >= 50000 && verdictScore >= 84 && (ageDays <= 365 || currentPlayers >= 1500))
    || (ageDays <= 240 && evidenceReviewCount >= 25000 && verdictScore >= 86)
    || (evidenceReviewCount >= 20000 && currentPlayers >= 3500 && verdictScore >= 84)
    || (ageDays <= 180 && evidenceReviewCount >= 10000 && currentPlayers >= 5000 && momentum >= 0.04 && verdictScore >= 83)
    || (ageDays <= 120 && hasBrowseTrendingSignal(row) && currentPlayers >= 10000 && momentum >= 0.08 && verdictScore >= 82)
    || (ageDays <= 90 && currentPlayers >= 8000 && momentum >= 0.07 && verdictScore >= 80);
}

export function getHomepageHeroScore(row: GameRow): number {
  const editorial = row.is_featured_manual ? 12 : 0;
  const verdict = Math.min(25, ((row.verdict_score ?? row.score ?? 0) / 100) * 25);
  const recentActivity = hasRecentHeroActivity(row);
  const momentum = recentActivity ? row.momentum ?? 0 : 0;
  const players = recentActivity ? row.current_players ?? 0 : 0;
  const evidenceReviewCount = getEvidenceReviewCount(row);
  const signalBoost = recentActivity && hasBrowseTrendingSignal(row) ? 6 : 0;
  const momentumBoost = Math.min(4, Math.max(0, momentum * 20));
  const playerBoost = Math.min(6, Math.log10(players + 1) * 1.8);
  const significance = signalBoost + momentumBoost + playerBoost;
  const ageDays = getHomepageHeroAgeDays(row);
  const freshness = ageDays < 120
    ? 20
    : ageDays < 240
      ? 14
      : ageDays < 365
        ? 10
        : ageDays < 730
          ? 6
          : ageDays < 1825
            ? 3
            : 0;
  const volume = Math.min(8, Math.log10(evidenceReviewCount + 1) * 2);
  const mediaQuality = row.header_image && row.header_image !== row.cover_image
    ? (/\/library_hero(?:_[^/]+)?\.|\/t_1080p\//i.test(row.header_image) ? 5 : 2)
    : 0;
  const independentRatingEvidence = hasStrongCriticEvidence(row) && evidenceReviewCount >= 1000;
  const lowPresencePenalty = !independentRatingEvidence && ageDays > 60 && players < 150 && momentum < 0.03 && evidenceReviewCount < 50000
    ? 16
    : !independentRatingEvidence && ageDays > 30 && players < 250 && momentum < 0.03 && evidenceReviewCount < 25000
      ? 10
      : 0;

  return editorial + verdict + significance + freshness + volume + mediaQuality - lowPresencePenalty;
}
