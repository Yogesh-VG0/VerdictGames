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

const GITHUB_ACTIONS_COMMANDS: Record<string, string> = {
  "refresh-trending": "gh workflow run scheduled-maintenance.yml -f job=refresh-trending",
  "discover-games": "gh workflow run scheduled-maintenance.yml -f job=discover-standard",
  "discover-games-deep": "gh workflow run scheduled-maintenance.yml -f job=discover-deep",
  "re-enrich": "gh workflow run scheduled-maintenance.yml -f job=re-enrich",
  "seed-curated-lists": "gh workflow run scheduled-maintenance.yml -f job=seed-curated-lists",
  "backfill-games": "gh workflow run scheduled-maintenance.yml -f job=backfill-games",
  "backfill-mobile-android": "gh workflow run scheduled-maintenance.yml -f job=backfill-mobile-android",
  "backfill-mobile-ios": "gh workflow run scheduled-maintenance.yml -f job=backfill-mobile-ios",
};

const TRIGGERABLE_JOBS: Record<string, {
  type: "cron" | "admin" | "github-actions-only";
  path?: string;
  method?: "GET" | "POST";
  description: string;
}> = {
  "re-enrich": {
    type: "cron",
    path: "/api/cron/re-enrich",
    method: "GET",
    description: "Manual serverless fallback only; recurring schedule runs on GitHub Actions.",
  },
  "refresh-trending": {
    type: "github-actions-only",
    description: "Refresh Steam player counts and trending flags (too slow for serverless)",
  },
  "discover-games": {
    type: "github-actions-only",
    description: "Discover and ingest new games from RAWG (~5+ min, too slow for serverless)",
  },
  "discover-games-deep": {
    type: "github-actions-only",
    description: "Run extended RAWG discovery (too slow for serverless)",
  },
  "seed-curated-lists": {
    type: "admin",
    path: "/api/admin/seed-lists",
    method: "POST",
    description: "Controlled 12-list reseed only; recurring 22-list schedule runs on GitHub Actions.",
  },
  "backfill-games": {
    type: "github-actions-only",
    description: "Bulk ingest games by year range (runs on GitHub Actions)",
  },
  "backfill-mobile-android": {
    type: "github-actions-only",
    description: "Verify Google Play store listings (runs on GitHub Actions)",
  },
  "backfill-mobile-ios": {
    type: "github-actions-only",
    description: "Verify App Store listings (runs on GitHub Actions)",
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

  // Long-running jobs are dispatched from GitHub rather than a serverless request.
  if (job.type === "github-actions-only") {
    const cliCmd = GITHUB_ACTIONS_COMMANDS[jobName];
    return jsonOk({
      success: false,
      job: jobName,
      message: `"${jobName}" is scheduled by GitHub Actions and cannot be triggered from the admin dashboard.\n\nRun manually via GitHub CLI:\n${cliCmd}`,
      githubActionsOnly: true,
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
      message: `Manual run for "${jobName}" completed successfully`,
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
    canTrigger: info.type !== "github-actions-only",
  }));

  return jsonOk({ jobs });
}
