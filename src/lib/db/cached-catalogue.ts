/** A failed read may be displayed partially, but must not become a cache value. */
export class IncompleteCatalogueRead<T> extends Error {
  constructor(readonly data: T, readonly failedSections: string[]) {
    super(`Catalogue sections unavailable: ${failedSections.join(', ')}`);
    this.name = 'IncompleteCatalogueRead';
  }
}

export function admitCataloguePayload<T>(data: T, sections: Record<string, PromiseSettledResult<unknown>>): T {
  const failed = Object.entries(sections).filter(([, result]) => result.status === 'rejected').map(([name]) => name);
  if (failed.length) throw new IncompleteCatalogueRead(data, failed);
  return data;
}

export async function readCachedCatalogue<T>(read: () => Promise<T>, fallback: T): Promise<{ data: T; degraded: boolean }> {
  try {
    return { data: await read(), degraded: false };
  } catch (error) {
    return { data: error instanceof IncompleteCatalogueRead ? error.data as T : fallback, degraded: true };
  }
}
