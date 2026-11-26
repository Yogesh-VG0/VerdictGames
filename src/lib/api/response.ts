/**
 * VERDICT.GAMES — API Response Helpers
 *
 * Consistent JSON response shapes for all route handlers.
 */

import { NextResponse } from "next/server";

const CACHE_PUBLIC = "s-maxage=60, stale-while-revalidate=300";

// Vercel's targeted CDN header takes precedence over Cache-Control, including
// headers set in deployment config. Set all three on identity-dependent data.
export const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

export function jsonPrivateOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export function jsonOk<T>(data: T, status = 200, options?: { cache?: boolean; cacheControl?: string }) {
  const headers: HeadersInit = {};
  if (options?.cacheControl) {
    headers["Cache-Control"] = options.cacheControl;
  } else if (options?.cache) {
    headers["Cache-Control"] = CACHE_PUBLIC;
  }
  return NextResponse.json({ success: true, data }, { status, headers: Object.keys(headers).length ? headers : undefined });
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export function jsonNotFound(entity = "Resource") {
  return jsonError(`${entity} not found.`, 404);
}

export function jsonBadRequest(message = "Invalid request.") {
  return jsonError(message, 400);
}

export function jsonUnavailable(message: string) {
  const response = jsonError(message, 503);
  response.headers.set("Retry-After", "30");
  return response;
}
