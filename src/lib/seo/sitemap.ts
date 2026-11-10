export async function collectSitemapRows<T>(fetchPage: (offset: number, size: number) => Promise<T[]>, pageSize = 500): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(offset, pageSize);
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}
