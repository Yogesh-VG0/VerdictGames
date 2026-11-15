// Shared by the Next ingestion path and standalone maintenance process.
export function portraitPriority(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return 0;
    if (parsed.hostname === 'images.igdb.com' && /\/t_cover_/.test(parsed.pathname)) return 30;
    if (/(^|\.)(steamstatic\.com|akamaihd\.net)$/.test(parsed.hostname) && /library_600x900/.test(parsed.pathname)) return 20;
    return 10;
  } catch { return 0; }
}

export function preferExistingCover(existing, incoming) {
  return Boolean(existing) && portraitPriority(existing) >= portraitPriority(incoming);
}
