/**
 * VERDICT.GAMES — API Response Helpers
 *
 * Consistent JSON response shapes for all route handlers.
 */

import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
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
