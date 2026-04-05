/**
 * VERDICT.GAMES — Rate Limiting Proxy
 *
 * In-memory sliding-window rate limiter for all API routes.
 * Different limits for public reads, authenticated writes, and sensitive endpoints.
 *
 * For production at scale, swap the in-memory Map for Redis (e.g. @upstash/ratelimit).
 *
 * Next.js 16.x: middleware.ts renamed to proxy.ts (see migration docs).
 */

import { NextRequest, NextResponse } from "next/server";

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

// ── In-memory sliding window store ──

interface WindowEntry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, WindowEntry>();

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const method = request.method;
  const config = getConfigForPath(pathname, method);
  const clientId = getClientIdentifier(request);

  // Key combines client IP + path prefix bucket (not full path, to avoid per-resource limits)
  const pathBucket = pathname.split("/").slice(0, 4).join("/"); // e.g. /api/reviews/[id]
  const key = `${clientId}:${pathBucket}:${method}`;

  const { allowed, remaining, resetAt } = checkRateLimit(key, config);

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
  matcher: ["/api/:path*"],
};
