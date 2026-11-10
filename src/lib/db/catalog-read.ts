// A single retry for a cancelled read helps small database instances recover
// from transient build/enrichment contention. Never use this for writes.
export async function retryCatalogRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== '57014') throw error;
    return read();
  }
}
