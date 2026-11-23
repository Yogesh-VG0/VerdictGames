import { describe, expect, it } from 'vitest';
import { getPlayerGrowthEvidence, getPlayerGrowthRank } from '../trending';

const now = Date.parse('2026-11-20T15:30:00Z');
const observe = (previous: number, current: number, hours = 4) => ({
  current_players: current,
  momentum: Math.round(Math.log((current + 1) / (previous + 1)) * 10000) / 10000,
  players_updated_at: new Date(now - hours * 3600000).toISOString(),
});

describe('dedicated Trending evidence', () => {
  it('accepts meaningful growth at small and large scales', () => {
    expect(getPlayerGrowthEvidence(observe(100, 131), now)).toBe('fresh');
    expect(getPlayerGrowthEvidence(observe(4000, 4210), now)).toBe('fresh');
    expect(getPlayerGrowthRank(observe(100, 131))).toBeGreaterThan(getPlayerGrowthRank(observe(4000, 4210)));
  });

  it('rejects tiny spikes, weak growth, undated and expired observations', () => {
    expect(getPlayerGrowthEvidence(observe(8, 45), now)).toBeNull();
    expect(getPlayerGrowthEvidence(observe(1000, 1010), now)).toBeNull();
    expect(getPlayerGrowthEvidence({ ...observe(100, 150), players_updated_at: null }, now)).toBeNull();
    expect(getPlayerGrowthEvidence(observe(100, 150, 28), now)).toBe('stale');
    expect(getPlayerGrowthEvidence(observe(100, 150, 169), now)).toBeNull();
  });
});
