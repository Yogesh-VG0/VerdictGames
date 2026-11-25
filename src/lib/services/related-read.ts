// Share pending public catalogue work within one process. Next.js owns settled
// values and expiry, so an incomplete or failed read is never memoized here.
export function createRelatedReadCoalescer<T>() {
  const pending = new Map<string, Promise<T>>();
  return (key: string, read: () => Promise<T>): Promise<T> => {
    const active = pending.get(key);
    if (active) return active;
    if (pending.size >= 128) return read();
    const result = Promise.resolve().then(read).finally(() => pending.delete(key));
    pending.set(key, result);
    return result;
  };
}
