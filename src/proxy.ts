/**
 * VERDICT.GAMES — Rate Limiting Proxy
 *
 * Per-instance burst limits plus shared atomic limits for writes and search.
 * Different limits for public reads, authenticated writes, and sensitive endpoints.
 *
 * Managed WAF protections run before application execution.
 *
 * Next.js 16.x: middleware.ts renamed to proxy.ts (see migration docs).
 */

import { NextRequest, NextResponse } from "next/server";
import { isMutation, isTrustedMutationOrigin, rateLimitBucket } from "@/lib/security/request";
import { createHmac } from 'node:crypto';
import { getServerSupabase } from '@/lib/supabase/server';

// ── Rate limit configuration ──

interface RateLimitConfig {
  /** Max requests in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/** Default: generous read limit */
const DEFAULT_LIMIT: RateLimitConfig = { limit: 60, windowSeconds: 60 };

/** Stricter limit for write/mutating endpoints */
const WRITE_LIMIT: RateLimitConfig = { limit: 20, windowSeconds: 60 };

/** Very strict limit for auth-related endpoints */
const AUTH_LIMIT: RateLimitConfig = { limit: 10, windowSeconds: 60 };

/** Strict limit for expensive operations (ingest, batch) */
const INGEST_LIMIT: RateLimitConfig = { limit: 5, windowSeconds: 60 };

// Map path prefixes to rate limit configs
function getConfigForPath(pathname: string, method: string): RateLimitConfig {
  // Auth endpoints — strictest
  if (pathname.startsWith("/api/auth/")) return AUTH_LIMIT;

  // Ingest/batch — very expensive
  if (pathname.startsWith("/api/ingest/")) return INGEST_LIMIT;

  // Cron endpoints — already secret-protected, but limit anyway
  if (pathname.startsWith("/api/cron/")) return INGEST_LIMIT;

  // Admin writes
  if (pathname.startsWith("/api/admin/") && method !== "GET") return WRITE_LIMIT;

  // User write operations
  if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
    return WRITE_LIMIT;
  }

  // Everything else (reads)
  return DEFAULT_LIMIT;
}

// ── Bounded fixed-window burst store ──

interface WindowEntry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, WindowEntry>();
const MAX_ENTRIES = 10000;

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

function getClientIdentifier(request: NextRequest): string {
  // Use X-Forwarded-For (set by Vercel/reverse proxies), fall back to IP
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return ip;
}

function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  cleanup();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    if (store.size >= MAX_ENTRIES) {
      for (const [storedKey, stored] of store) if (stored.resetAt <= now) store.delete(storedKey);
      if (store.size >= MAX_ENTRIES) return { allowed: false, remaining: 0, resetAt: now + 1000 };
    }
    // New window
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  // Existing window
  entry.count++;
  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

// ── Proxy ──

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  if (isMutation(request.method)) {
    if (!isTrustedMutationOrigin(request.headers, request.nextUrl.origin, process.env.NEXT_PUBLIC_SITE_URL)) {
      return NextResponse.json({ error: 'Untrusted request origin' }, { status: 403 });
    }
    const contentType = request.headers.get('content-type')?.split(';')[0].trim();
    if (contentType && !['application/json', 'multipart/form-data'].includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }
  }

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/") && pathname !== '/search') {
    return NextResponse.next();
  }

  const method = request.method;
  const config = getConfigForPath(pathname, method);
  const clientId = getClientIdentifier(request);

  // Key combines client IP + path prefix bucket (not full path, to avoid per-resource limits)
  const pathBucket = rateLimitBucket(pathname);
  const key = `${clientId}:${pathBucket}:${method}`;

  let { allowed, remaining, resetAt } = checkRateLimit(key, config);

  // Shared atomic limits protect writes and expensive search across instances.
  // Cached game pages avoid this DB call entirely; managed WAF runs first.
  const sharedLimit = isMutation(method) || pathname === '/search' || pathname === '/api/search';
  if (allowed && sharedLimit && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const bucket = createHmac('sha256', process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY).update(key).digest('hex');
    try {
      const { data, error } = await getServerSupabase().rpc('consume_api_rate_limit', {
        p_bucket: bucket, p_limit: config.limit, p_window: config.windowSeconds,
      }).abortSignal(AbortSignal.timeout(5000));
      if (error || !data?.[0]) throw new Error('Rate-limit storage unavailable');
      allowed = data[0].allowed;
      remaining = data[0].remaining;
      resetAt = Date.parse(data[0].reset_at);
    } catch (error) {
      console.warn('[Rate limit] Shared storage unavailable', {
        type: error instanceof Error ? error.name : 'RPC_ERROR',
      });
      return NextResponse.json({ error: 'Temporarily unavailable. Please retry.' }, { status: 503, headers: { 'Retry-After': '5' } });
    }
  }

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-RateLimit-Limit", String(config.limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/search"],
};
