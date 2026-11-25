import { appendFileSync } from 'node:fs';

// Loaded only by the scheduled worker step. Count fetch attempts, including
// provider retries, without writing credentials, URLs, or response data.
export const providerBudgets = {
  'refresh-upcoming-snapshot': { rawg: 50 },
  're-enrich': { rawg: 50, steam: 40, igdb: 30 },
  'discover-standard': { rawg: 115, steam: 40, igdb: 45 },
  'discover-steam-popular': { rawg: 18, steam: 15, igdb: 12 },
  'discover-deep': { rawg: 22, steam: 16, igdb: 16 },
  'backfill-games': { rawg: 24, steam: 16, igdb: 16 },
  'refresh-trending': { steam: 36, igdb: 6 },
  'refresh-player-counts': { steam: 36 },
  'refresh-steam-reviews': { steam: 25 },
  'backfill-mobile-ios': { apple: 25 },
};

export function getProvider(input) {
  const host = new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname;
  if (host === 'api.rawg.io') return 'rawg';
  if (host === 'api.steampowered.com' || host === 'store.steampowered.com') return 'steam';
  if (host === 'api.igdb.com' || host === 'id.twitch.tv') return 'igdb';
  if (host === 'itunes.apple.com') return 'apple';
  return 'other';
}

const job = process.env.CATALOGUE_BUDGET_JOB;
const budget = job && providerBudgets[job];
const counts = {};
const blocked = new Set();

function attemptLimit(provider) {
  return budget[provider] ?? (provider === 'other' ? 100 : 0);
}

export function hasOptionalMaintenanceFetchCapacity(input) {
  if (!budget) return true;
  const provider = getProvider(input);
  return (counts[provider] ?? 0) < attemptLimit(provider);
}

export function readMaintenanceBudget() {
  return job && providerBudgets[job] ? { provider_attempts: { ...counts }, budget_exhausted: [...blocked] } : null;
}

if (budget) {
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const provider = getProvider(input);
    const count = counts[provider] ?? 0;
    if (count >= attemptLimit(provider)) {
      blocked.add(provider);
      throw new Error(`Maintenance request budget reached for ${provider}`);
    }
    counts[provider] = count + 1;
    return baseFetch(input, init);
  };
  process.on('exit', () => {
    const summary = JSON.stringify({ job, fetchAttempts: counts, budgetExhausted: [...blocked] });
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\nProvider attempts: ' + summary + '\n');
    if (blocked.size) process.exitCode ||= 1;
  });
}
