import { isPublicContentAllowed } from './public-safety.mjs';
import { isUpcomingSnapshot } from '../external/rawg-snapshot.mjs';

const unreleased = new Set(['announced', 'coming soon', 'upcoming', 'unreleased', 'tba', 'cancelled', 'canceled', 'delisted']);
const released = new Set(['released', 'full release']);
const coOp = ['co op', 'online co op', 'local co op', 'co op campaign', 'co operative'];
const multiplayer = ['multiplayer', 'local multiplayer', 'online multiplayer', 'pvp', 'massively multiplayer', 'mmo', ...coOp];
const strategy = ['city builder', 'base building', 'colony sim', '4x', 'grand strategy', 'rts', 'real time strategy', 'turn based strategy', 'real time tactics', 'turn based tactics', 'wargame'];
const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');

// Entries are [score, review floor, years since launch, thematic evidence].
// Stored tags are classification evidence. Official mode confirmations are
// appended during normal enrichment whenever the existing IGDB match has them.
const contracts = {
  'best-single-player-rpgs': [78, 20, 4, (genre, tag, any) =>
    genre('rpg') && tag('singleplayer', 'single player')
      && any('crpg', 'jrpg', 'action rpg', 'character customization', 'party based rpg', 'turn based combat')
      && !any('massively multiplayer', 'mmo', 'mmorpg', 'battle royale')],
  'best-co-op-games': [74, 20, 4, (_genre, tag) => tag(...coOp)],
  'best-horror-games': [72, 20, 5, (_genre, tag, any) => tag('survival horror', 'psychological horror', 'lovecraftian')
    || (any('horror') && tag('dark', 'supernatural', 'gore', 'fear') && !any('puzzle platformer', 'cozy', 'relaxing'))],
  'best-strategy-builder-games': [76, 20, 5, (_genre, _tag, any) => any(...strategy)],
  'best-story-driven-adventures': [78, 20, 4, (genre, tag, any) =>
    (genre('adventure', 'rpg') || tag('visual novel', 'interactive fiction'))
      && any('story rich', 'choices matter', 'narrative', 'visual novel', 'interactive fiction')],
  'best-indie-under-20-hours': [80, 20, 4, (_genre, tag, any, row) =>
    any('indie') && row.hltb_main > 0 && row.hltb_main <= 20 && tag('singleplayer', 'single player')],
  'best-competitive-multiplayer': [72, 20, 5, (_genre, _tag, any) =>
    any('pvp', 'competitive', 'esports', 'battle royale', 'moba', 'arena shooter') && any(...multiplayer)],
  'best-deckbuilders-turn-based': [76, 20, 5, (_genre, _tag, any) =>
    any('deckbuilder', 'deckbuilding', 'roguelike deckbuilder', 'card game', 'turn based combat', 'turn based tactics', 'turn based strategy')],
  'hidden-gems-since-2024': [82, 20, 0, (_genre, _tag, _any, row) =>
    row.release_date >= '2024-01-01' && row.review_count < 1000],
  'sci-fi-epics': [78, 50, 0, (_genre, _tag, any, row) =>
    any('sci fi', 'science fiction', 'cyberpunk', 'space opera') && any('adventure', 'rpg', 'story rich', 'open world')
    && (row.hltb_main >= 10 || any('open world', 'space opera'))],
  'best-platformers': [78, 50, 0, (_genre, _tag, any) =>
    any('platformer', '2d platformer', '3d platformer', 'precision platformer', 'puzzle platformer', 'collectathon')],
  'best-roguelikes-roguelites': [78, 50, 0, (_genre, _tag, any) =>
    any('roguelike', 'roguelite', 'rogue like', 'rogue lite', 'roguevania', 'roguelike deckbuilder')],
  'critically-acclaimed-2024': [80, 50, 0, (_genre, _tag, _any, row) =>
    row.release_date.startsWith('2024-') && (row.critic_source_count ?? 0) >= 1 && (row.critic_score ?? 0) >= 80],
  'best-multiplayer-experiences': [76, 50, 0, (_genre, _tag, any) => any(...multiplayer)],
  'survival-horror-essentials': [76, 50, 0, (_genre, tag, any) =>
    tag('survival horror') || (any('horror', 'psychological horror') && tag('survival', 'resource management'))],
  'best-strategy-games': [78, 50, 0, (_genre, _tag, any) => any(...strategy)],
  'top-open-world-adventures': [78, 50, 0, (genre, tag) =>
    tag('open world') && (genre('adventure', 'action', 'rpg') || tag('exploration', 'action adventure', 'action rpg'))
      && !genre('sports', 'racing', 'strategy')],
  'essential-metroidvanias': [78, 50, 0, (_genre, tag, any) =>
    tag('metroidvania') && any('platformer', '2d platformer', 'action', 'action adventure', 'exploration')],
  'hidden-indie-gems': [84, 20, 0, (_genre, _tag, any, row) => any('indie') && row.review_count < 500],
  'cozy-games-to-unwind': [76, 50, 0, (_genre, tag, any) =>
    tag('cozy', 'relaxing', 'wholesome', 'farming sim', 'life sim') && !any('horror', 'survival horror', 'pvp')],
  'best-action-rpgs': [80, 50, 0, (genre, tag) => genre('rpg')
    && (tag('action rpg') || (genre('action') && tag('souls like', 'soulslike', 'real time combat')))],
};

export const EDITORIAL_GAME_COLUMNS = 'id,title,description,cover_image,genres,tags,release_date,release_status,is_provisional,verdict_label,score,review_count,confidence,critic_score,critic_source_count,hltb_main,rawg_id';
export const EDITORIAL_UPCOMING_SNAPSHOT_KEY = 'discovery:rawg:upcoming:v1';

export function editorialAnticipation(payload) {
  const rows = isUpcomingSnapshot(payload) ? payload.results : [];
  return new Map(rows.filter(row => !row.tba && row.released && row.added >= 100)
    .map(row => [row.id, { date: row.released, interest: row.added }]));
}

export function matchesEditorialAnticipation(game, anticipation) {
  return anticipation.get(game.rawg_id)?.date === game.release_date;
}

export function selectEditorialIds(rankedIds, appearances, limit = 12) {
  const distinct = [...new Set(rankedIds)];
  const lessRepeated = distinct.filter(id => (appearances.get(id) ?? 0) < 3);
  const preferred = new Set(lessRepeated);
  return [...lessRepeated, ...distinct.filter(id => !preferred.has(id))].slice(0, limit);
}

export function compareEditorialGames(slug, a, b, anticipation = new Map()) {
  const score = row => ((row.score ?? 0) * (row.review_count ?? 0) + 15_000) / ((row.review_count ?? 0) + 200);
  const players = (b.current_players ?? 0) - (a.current_players ?? 0);
  const reviews = (b.review_count ?? 0) - (a.review_count ?? 0);
  const quality = score(b) - score(a);
  const stable = () => a.id.localeCompare(b.id);
  if (/^most-wanted-\d{4}$/.test(slug)) return (anticipation.get(b.rawg_id)?.interest ?? 0) - (anticipation.get(a.rawg_id)?.interest ?? 0)
    || a.release_date.localeCompare(b.release_date) || stable();
  if (slug === 'best-competitive-multiplayer') return players || quality || stable();
  if (slug === 'hidden-gems-since-2024' || slug === 'hidden-indie-gems') return quality || -reviews || stable();
  return quality || reviews || players || stable();
}

/** @param {string} slug @param {Record<string, any>} row @param {string} [today] */
export function editorialExclusion(slug, row, today = new Date().toISOString().slice(0, 10)) {
  const annual = /^most-wanted-(\d{4})$/.exec(slug);
  const rule = Object.hasOwn(contracts, slug) ? contracts[slug] : undefined;
  if (!annual && !rule) return null;
  const genres = new Set((row.genres ?? []).map(normalize));
  const tags = new Set((row.tags ?? []).map(normalize));
  const genre = (...values) => values.some(value => genres.has(value));
  const tag = (...values) => values.some(value => tags.has(value));
  const any = (...values) => genre(...values) || tag(...values);
  const status = normalize(row.release_status);
  const date = row.release_date;
  if (!row.title || !row.cover_image || !isPublicContentAllowed(row)) return 'catalogue visibility or artwork';
  if (any('utilities', 'software', 'game development', 'audio production', 'design & illustration', 'dlc', 'soundtrack')
    || /(?:soundpad|soundtrack|season pass|expansion pass|dlc pack|remaster collection)\s*$/i.test(row.title)) return 'supplemental content or software';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return 'missing dated release evidence';
  if (annual) {
    if (date <= today || !date.startsWith(annual[1] + '-') || date.endsWith('-12-31')) return 'outside the verified annual window';
    if (released.has(status) || ['cancelled', 'canceled', 'delisted', 'early access', 'tba'].includes(status) || any('early access')) return 'incompatible lifecycle';
    return row.rawg_id > 0 && ['announced', 'coming soon', 'unreleased', 'upcoming'].includes(status) ? null : 'missing explicit upcoming evidence';
  }

  if (date > today || unreleased.has(status) || status === 'early access'
    || (!released.has(status) && (any('early access') || row.is_provisional || row.verdict_label === 'COMING SOON'))) return 'full release required';
  const [score, reviews, years, matches] = rule;
  if (years && date < String(Number(today.slice(0, 4)) - years) + today.slice(4)) return 'outside the editorial release window';
  if ((row.score ?? 0) < score || (row.review_count ?? 0) < reviews
    || ((row.confidence ?? 0) < 0.2 && !((row.critic_source_count ?? 0) > 0 && (row.critic_score ?? 0) >= 80))) return 'insufficient review evidence';
  return matches(genre, tag, any, row) ? null : 'insufficient genre, mode or playtime evidence';
}

export function withVerifiedEditorialModes(tags, modes) {
  const labels = { 'single player': 'Singleplayer', multiplayer: 'Multiplayer', 'co operative': 'Co-op', cooperative: 'Co-op' };
  return [...new Set([...tags, ...(modes ?? []).map(mode => Object.hasOwn(labels, normalize(mode.name)) ? labels[normalize(mode.name)] : null).filter(Boolean)])];
}
