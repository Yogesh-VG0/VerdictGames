import { describe, expect, it } from 'vitest';
import { editorialExclusion, selectEditorialIds, withVerifiedEditorialModes } from '../editorial-eligibility.mjs';

const today = '2026-11-20';
const base = {
  title: 'Editorial Fixture', cover_image: 'https://images.igdb.com/cover.webp', release_date: '2024-06-15',
  release_status: 'released', score: 91, review_count: 130, confidence: 0.7, critic_score: 85,
  critic_source_count: 1, hltb_main: 14, genres: ['Adventure'], tags: [],
};

describe('system collection eligibility', () => {
  it.each([
    ['best-single-player-rpgs', ['RPG'], ['Singleplayer', 'JRPG']],
    ['best-co-op-games', ['Adventure'], ['Local Co-Op']],
    ['best-horror-games', ['Adventure'], ['Psychological Horror']],
    ['best-strategy-builder-games', ['Simulation'], ['City Builder']],
    ['best-story-driven-adventures', ['Adventure'], ['Story Rich']],
    ['best-indie-under-20-hours', ['Indie'], ['Singleplayer']],
    ['best-competitive-multiplayer', ['Shooter'], ['PvP', 'Multiplayer']],
    ['best-deckbuilders-turn-based', ['Strategy'], ['Card Game']],
    ['hidden-gems-since-2024', ['Indie'], []],
    ['sci-fi-epics', ['Adventure'], ['Sci-fi', 'Story Rich']],
    ['best-platformers', ['Platformer'], []],
    ['best-roguelikes-roguelites', ['Action'], ['Roguelite']],
    ['critically-acclaimed-2024', ['Action'], []],
    ['best-multiplayer-experiences', ['Shooter'], ['Multiplayer']],
    ['survival-horror-essentials', ['Adventure'], ['Survival Horror']],
    ['best-strategy-games', ['Strategy'], ['4X']],
    ['top-open-world-adventures', ['Adventure'], ['Open World']],
    ['essential-metroidvanias', ['Action'], ['Metroidvania']],
    ['hidden-indie-gems', ['Indie'], []],
    ['cozy-games-to-unwind', ['Simulation'], ['Cozy']],
    ['best-action-rpgs', ['Action', 'RPG'], ['Action RPG']],
  ])('applies dated evidence and eligibility to %s', (slug, genres, tags) => {
    const game = { ...base, genres, tags };
    expect(editorialExclusion(slug, game, today)).toBeNull();
    expect(editorialExclusion(slug, { ...game, release_status: 'cancelled' }, today)).toBe('full release required');
    expect(editorialExclusion(slug, { ...game, review_count: 1 }, today)).toBe('insufficient review evidence');
  });

  it('requires a dated, explicitly unreleased base game in the annual collection', () => {
    const game = { ...base, rawg_id: 12, release_status: 'upcoming', release_date: '2026-12-04' };
    const reason = (overrides = {}) => editorialExclusion('most-wanted-2026', { ...game, ...overrides }, today);
    expect(reason()).toBeNull();
    for (const overrides of [{ title: 'The Beatbox Soundpad' }, { release_date: '2022-01-01' },
      { release_date: '2026-12-31' }, { release_date: '2027-01-15' }, { release_status: 'released' },
      { release_status: 'cancelled' }, { release_status: 'early_access' }, { release_status: null }]) {
      expect(reason(overrides)).toBeTruthy();
    }
  });

  it('rejects broad labels and unknown playtime and does not pad a short list', () => {
    expect(editorialExclusion('best-horror-games', { ...base, genres: ['Puzzle', 'Horror'] }, today)).toBeTruthy();
    expect(editorialExclusion('best-strategy-games', { ...base, genres: ['Strategy', 'Puzzle'] }, today)).toBeTruthy();
    expect(editorialExclusion('best-co-op-games', { ...base, tags: ['Multiplayer'] }, today)).toBeTruthy();
    expect(editorialExclusion('best-indie-under-20-hours', { ...base, genres: ['Indie'], tags: ['Singleplayer'], hltb_main: null }, today)).toBeTruthy();
    expect(editorialExclusion('best-action-rpgs', { ...base, genres: ['RPG', 'Action'], tags: ['Roguelike'] }, today)).toBeTruthy();
    expect(selectEditorialIds(['overlap', 'fresh', 'overlap'], new Map([['overlap', 5]]))).toEqual(['fresh', 'overlap']);
    expect(withVerifiedEditorialModes(['Local Co-Op'], [{ name: 'Multiplayer' }, { name: 'Unknown' }])).toEqual(['Local Co-Op', 'Multiplayer']);
  });
});
