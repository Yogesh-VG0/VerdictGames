const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isMutation(method: string): boolean { return !SAFE_METHODS.has(method.toUpperCase()); }

export function isTrustedMutationOrigin(headers: Headers, requestOrigin: string, siteUrl?: string): boolean {
  const origin = headers.get('origin');
  // Same-origin browser mutations carry Origin. Cookie-free service calls
  // still require the authentication enforced by their endpoint.
  if (!origin) return !headers.has('cookie');
  const trusted = new Set([requestOrigin]);
  if (siteUrl) { try { trusted.add(new URL(siteUrl).origin); } catch { /* fail closed */ } }
  return trusted.has(origin);
}

export function rateLimitBucket(path: string): string {
  if (path.startsWith('/game/')) return '/game/:slug';
  if (path === '/search') return '/search';
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'api') return path;
  if (parts[1] === 'games') {
    const staticRoutes = new Set(['stats', 'trending', 'new-releases', 'top-rated']);
    return staticRoutes.has(parts[2]) ? `/api/games/${parts[2]}` : `/api/games/:slug/${parts[3] ?? 'detail'}`;
  }
  if (parts[1] === 'reviews') return `/api/reviews/${parts[3] ?? 'collection'}`;
  if (parts[1] === 'admin') return `/api/admin/${parts[2] ?? 'root'}`;
  return `/api/${parts[1] ?? 'root'}`;
}

export function safeRedirectPath(path: string | null, fallback = '/'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020]/.test(path)) return fallback;
  try {
    const base = 'https://redirect.invalid';
    const parsed = new URL(path, base);
    return parsed.origin === base ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch { return fallback; }
}
