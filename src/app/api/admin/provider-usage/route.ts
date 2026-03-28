/**
 * GET /api/admin/provider-usage
 * 
 * Returns API provider usage summary for budget monitoring.
 */

import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getProviderUsageSummary } from "@/lib/utils/providerUsage";

export async function GET(_request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const summary = await getProviderUsageSummary();
    return jsonOk(summary);
  } catch (err) {
    console.error("[API] /admin/provider-usage error:", err);
    return jsonError("Failed to fetch provider usage", 500);
  }
}
