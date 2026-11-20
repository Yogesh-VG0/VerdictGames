// A fixture-only proposal. This program never creates a database client.
import { readFile } from 'node:fs/promises';
import {
  compareEditorialGames, editorialAnticipation, editorialExclusion,
  matchesEditorialAnticipation, selectEditorialIds,
} from '../src/lib/utils/editorial-eligibility.mjs';

const input = process.argv[2];
if (!input) throw new Error('Supply a JSON fixture with asOf, games, lists, and an optional upcomingSnapshot');
const { asOf, games, lists, upcomingSnapshot } = JSON.parse(await readFile(input, 'utf8'));
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf ?? '') || !Array.isArray(games) || !Array.isArray(lists)) throw new Error('Invalid editorial fixture');
const byId = new Map(games.map(game => [game.id, game]));
const anticipation = editorialAnticipation(upcomingSnapshot);
const appearances = new Map();
const plan = lists.filter(list => list.is_system_managed && list.is_public).map(list => {
  const annual = /^most-wanted-\d{4}$/.test(list.slug);
  const reason = (game) => editorialExclusion(list.slug, game, asOf)
    ?? (annual && !matchesEditorialAnticipation(game, anticipation) ? 'no matching recorded anticipation' : null);
  const before = (list.game_ids ?? []).map(id => {
    const game = byId.get(id);
    return { id, title: game?.title ?? null, exclusion: game ? reason(game) : 'missing from fixture' };
  });
  const ordered = games.filter(game => !reason(game))
    .sort((a, b) => compareEditorialGames(list.slug, a, b, anticipation));
  const unique = new Set();
  const ranked = ordered.filter(game => {
    const canonical = game.steam_app_id > 0 ? `steam:${game.steam_app_id}` : `title:${game.title.toLowerCase().trim()}`;
    if (unique.has(canonical)) return false;
    unique.add(canonical);
    return true;
  });
  const after = selectEditorialIds(ranked.map(game => game.id), appearances).map(id => {
    appearances.set(id, (appearances.get(id) ?? 0) + 1);
    return { id, title: byId.get(id).title };
  });
  return { slug: list.slug, before, after, oldCount: before.length, proposedCount: after.length };
});
console.log(JSON.stringify({ asOf, fixtureRows: games.length, lists: plan }, null, 2));
