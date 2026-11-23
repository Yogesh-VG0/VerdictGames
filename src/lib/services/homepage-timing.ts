import { AsyncLocalStorage } from 'node:async_hooks';

type Rail = 'hero' | 'trending' | 'new_releases' | 'top_rated' | 'recommendations' | 'deals';
type Phase = `rail_${Rail}` | `refresh_${Rail}`
  | 'homepage_total' | 'rail_queue' | 'database' | 'candidate_selection' | 'candidate_hydration'
  | 'provider_snapshot' | 'provider_fetch' | 'provider_fallback' | 'serialization';

type Sample = { elapsed: number; active: number };
const timings = new AsyncLocalStorage<Map<Phase, Sample>>();

export function withHomepageTimings<T>(read: (header: () => string) => Promise<T>): Promise<T> {
  const phases = new Map<Phase, Sample>();
  return timings.run(phases, () => read(() => Array.from(phases, ([phase, sample]) =>
    `${phase};dur=${sample.elapsed.toFixed(1)}${sample.active ? ';desc="in-flight"' : ''}`).join(', ')));
}

export function startHomepagePhase(phase: Phase): () => void {
  const phases = timings.getStore();
  if (!phases) return () => {};
  const sample = phases.get(phase) ?? { elapsed: 0, active: 0 };
  phases.set(phase, sample);
  sample.active++;
  const start = performance.now();
  // Repeated or overlapping operations contribute cumulative time.
  return () => {
    sample.elapsed += performance.now() - start;
    sample.active--;
  };
}

export async function measureHomepagePhase<T>(phase: Phase, read: () => T | PromiseLike<T>): Promise<T> {
  const end = startHomepagePhase(phase);
  try {
    return await read();
  } finally {
    end();
  }
}
