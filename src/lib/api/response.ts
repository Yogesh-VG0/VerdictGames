/**
 * VERDICT.GAMES — API Response Helpers
 *
 * Consistent JSON response shapes for all route handlers.
 */

import { NextResponse } from "next/server";

const CACHE_PUBLIC = "s-maxage=60, stale-while-revalidate=300";

export function jsonOk<T>(data: T, status = 200, options?: { cache?: boolean }) {
  const headers: HeadersInit = {};
  if (options?.cache) headers["Cache-Control"] = CACHE_PUBLIC;
  return NextResponse.json({ success: true, data }, { status, headers: Object.keys(headers).length ? headers : undefined });
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function jsonNotFound(entity = "Resource") {
  return jsonError(`${entity} not found.`, 404);
}

export function jsonBadRequest(message = "Invalid request.") {
  return jsonError(message, 400);
}
