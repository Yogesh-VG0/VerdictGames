import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { NextRequest } from "next/server";

export const maxDuration = 300; // 5 min max

/**
 * POST /api/admin/scheduler-runs/trigger
 *
 * Manually trigger a scheduler job from the admin dashboard.
 * Proxies to the internal cron routes with CRON_SECRET, or
 * directly invokes admin endpoints for non-cron jobs.
 *
 * Body: { job: string, params?: Record<string, string> }
 */

const TRIGGERABLE_JOBS: Record<string, {
  type: "cron" | "admin" | "heroku-only";
  path?: string;
  method?: "GET" | "POST";
  description: string;
}> = {
  "re-enrich": {
    type: "cron",
    path: "/api/cron/re-enrich",
    method: "GET",
    description: "Re-enrich stale games (refreshes RAWG/IGDB/Steam data for oldest-enriched games)",
  },
  "refresh-trending": {
    type: "cron",
    path: "/api/cron/refresh-trending",
    method: "GET",
    description: "Refresh trending & featured flags using IGDB PopScore + RAWG + GX data",
  },
  "discover-games": {
    type: "cron",
    path: "/api/cron/discover",
    method: "GET",
    description: "Discover and ingest new games from RAWG (trending, new releases, top rated)",
  },
  "seed-curated-lists": {
    type: "admin",
    path: "/api/admin/seed-lists",
    method: "POST",
    description: "Regenerate all 12 editorial curated lists from current game data",
  },
  "backfill-games": {
    type: "heroku-only",
    description: "Bulk ingest games by year range (runs on Heroku — too heavy for serverless)",
  },
  "backfill-mobile-android": {
    type: "heroku-only",
    description: "Verify Google Play store listings for all games with Android platform (runs on Heroku)",
  },
  "backfill-mobile-ios": {
    type: "heroku-only",
    description: "Verify App Store listings for all games with iOS platform (runs on Heroku)",
  },
};

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const jobName = body.job as string;
  const params = (body.params ?? {}) as Record<string, string>;

  if (!jobName || !TRIGGERABLE_JOBS[jobName]) {
    return jsonError(`Unknown job: ${jobName}. Valid jobs: ${Object.keys(TRIGGERABLE_JOBS).join(", ")}`, 400);
  }

  const job = TRIGGERABLE_JOBS[jobName];

  // Heroku-only jobs can't be triggered from the web app
  if (job.type === "heroku-only") {
    return jsonOk({
      success: false,
      job: jobName,
      message: `"${jobName}" runs on Heroku and cannot be triggered from the admin dashboard. Use the Heroku CLI instead:\n\nheroku run node scripts/heroku-${jobName.replace("backfill-mobile-", "backfill-mobile-listings.mjs --").replace("backfill-games", "backfill-games.mjs")}\n\nOr run it locally:\nnode scripts/heroku-${jobName.replace("backfill-mobile-android", "backfill-mobile-listings.mjs --android-only").replace("backfill-mobile-ios", "backfill-mobile-listings.mjs --ios-only").replace("backfill-games", "backfill-games.mjs")}`,
      herokuOnly: true,
    });
  }

  // Build the internal URL
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
    || req.nextUrl.origin;

  try {
    let url: string;
    const fetchOpts: RequestInit = { signal: AbortSignal.timeout(290_000) };

    if (job.type === "cron") {
      // Cron routes use GET + secret query param
      const qp = new URLSearchParams({ secret: cronSecret || "" });
      // Pass through any custom params (e.g., limit, deep)
      for (const [k, v] of Object.entries(params)) {
        qp.set(k, v);
      }
      url = `${baseUrl}${job.path}?${qp}`;
      fetchOpts.method = "GET";
    } else {
      // Admin routes use POST + cookie auth forwarded
      url = `${baseUrl}${job.path}`;
      fetchOpts.method = "POST";
      fetchOpts.headers = {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") || "",
      };
    }

    const res = await fetch(url, fetchOpts);
    const data = await res.json().catch(() => ({ error: "Non-JSON response" }));

    if (!res.ok) {
      return jsonOk({
        success: false,
        job: jobName,
        message: `Job "${jobName}" returned status ${res.status}: ${data.error || JSON.stringify(data)}`,
        statusCode: res.status,
        data,
      });
    }

    return jsonOk({
      success: true,
      job: jobName,
      message: `Job "${jobName}" completed successfully`,
      data: data.success !== undefined ? data.data ?? data : data,
    });
  } catch (err) {
    return jsonError(`Job "${jobName}" failed: ${(err as Error).message}`, 500);
  }
}

/** GET: list available jobs and their trigger status */
export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const jobs = Object.entries(TRIGGERABLE_JOBS).map(([name, info]) => ({
    name,
    ...info,
    canTrigger: info.type !== "heroku-only",
  }));

  return jsonOk({ jobs });
}
