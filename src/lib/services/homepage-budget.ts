import { AsyncLocalStorage } from 'node:async_hooks';

const budget = new AsyncLocalStorage<AbortSignal>();

/** Combine the section budget with a transport's narrower timeout. */
export function homepageSignal(signal: AbortSignal): AbortSignal {
  const section = budget.getStore();
  return section ? AbortSignal.any([signal, section]) : signal;
}

export function currentHomepageSignal(): AbortSignal | undefined {
  return budget.getStore();
}

export async function boundedHomepageRead<T>(ms: number, read: () => Promise<T>): Promise<T> {
  const signal = homepageSignal(AbortSignal.timeout(ms));
  signal.throwIfAborted();
  let rejectOnAbort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(signal.reason);
    signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  try {
    // This also bounds framework cache lookups. Network calls inside the work
    // receive the same signal and queued refreshes remove themselves on abort.
    return await Promise.race([deadline, budget.run(signal, read)]);
  } finally {
    signal.removeEventListener('abort', rejectOnAbort);
  }
}
