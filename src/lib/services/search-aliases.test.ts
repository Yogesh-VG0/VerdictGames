import { describe, expect, it } from 'vitest';
import { expandGameSearchAlias } from '@/lib/search';
import { dedupePublicCanonicalRows, getPublicCanonicalPreference } from '@/lib/utils/publicCanonical';
import type { GameRow } from '@/lib/supabase/types';
import { GAME_DETAIL_SLUG_REDIRECTS } from './game-detail';

describe('catalogue identity aliases', () => {
  it.each([['GTA', 'Grand Theft Auto'], ['gta 5', 'Grand Theft Auto V'], ['GTA IV', 'Grand Theft Auto IV'],
    ['CS2', 'Counter Strike 2'], ['cs 2', 'Counter Strike 2'], ['gta-like', 'gta-like'],
  ])('expands %s without changing unrelated search text', (query, expected) => {
    expect(expandGameSearchAlias(query)).toBe(expected);
  });
  it('uses the existing current Counter-Strike identity preference and Wukong canonical slug', () => {
    expect(getPublicCanonicalPreference(expandGameSearchAlias('cs2'))).toBe('counter-strike-current');
    expect(GAME_DETAIL_SLUG_REDIRECTS['black-myth-wu-kong']).toBe('black-myth-wukong');
  });
  it('returns Counter-Strike 2 when a historical GO row shares Steam app 730', () => {
    const current = { id: '2', title: 'Counter-Strike 2', steam_app_id: 730, score: 85, review_count: 100 } as GameRow;
    const legacy = { id: '1', title: 'Counter-Strike: Global Offensive', steam_app_id: 730, score: 98,
      current_players: 1000000, review_count: 9000000 } as GameRow;
    expect(dedupePublicCanonicalRows([legacy, current], { query: expandGameSearchAlias('CS2') })).toEqual([current]);
  });
});
