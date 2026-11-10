import { describe, expect, it } from 'vitest';
import { isTrustedMutationOrigin, rateLimitBucket, safeRedirectPath } from './request';

describe('cookie mutation origin checks', () => {
  it('accepts same-origin browser writes and rejects cross-origin and null origins', () => {
    expect(isTrustedMutationOrigin(new Headers({ origin: 'https://www.verdict.games', cookie: 'session=test' }), 'https://www.verdict.games')).toBe(true);
    for (const origin of ['https://evil.example', 'null']) {
      expect(isTrustedMutationOrigin(new Headers({ origin, cookie: 'session=test' }), 'https://www.verdict.games')).toBe(false);
    }
    expect(isTrustedMutationOrigin(new Headers({ cookie: 'session=test' }), 'https://www.verdict.games')).toBe(false);
    expect(isTrustedMutationOrigin(new Headers({ authorization: 'Bearer machine-token' }), 'https://www.verdict.games')).toBe(true);
  });
});

describe('safe OAuth redirects', () => {
  it('preserves local paths and blocks alternate-origin URL forms', () => {
    expect(safeRedirectPath('/reset-password?flow=recovery')).toBe('/reset-password?flow=recovery');
    for (const path of ['//example.com', '/\\example.com', 'https://example.com', '/\texample.com', 'javascript:alert(1)']) {
      expect(safeRedirectPath(path, '/reset-password')).toBe('/reset-password');
    }
  });
});

describe('rate-limit resource rotation', () => {
  it('shares budgets across different game slugs and review IDs', () => {
    expect(rateLimitBucket('/api/games/hades/news')).toBe(rateLimitBucket('/api/games/doom/news'));
    expect(rateLimitBucket('/api/reviews/a/vote')).toBe(rateLimitBucket('/api/reviews/b/vote'));
    expect(rateLimitBucket('/api/games/top-rated')).not.toBe(rateLimitBucket('/api/games/hades'));
  });
});
