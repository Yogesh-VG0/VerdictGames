import { jsonPrivateOk as jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { parseSchedulerMetadata } from '@/lib/scheduler-metadata';

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const jobName = searchParams.get("job") || null;

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const displayStatus = (row: { status: string; started_at: string; metadata?: unknown }) => {
    if (parseSchedulerMetadata(row.metadata)?.outcome === 'deferred') return 'deferred';
    return row.status === 'running' && row.started_at < twoHoursAgo ? 'stale' : row.status;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("scheduler_runs") as any)
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (jobName) {
    query = query.eq("job_name", jobName);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return jsonError("Scheduler history is unavailable.", 503);
  }

  // Also fetch summary stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stats, error: statsError } = await (supabase.from("scheduler_runs") as any)
    .select("job_name, status, started_at, metadata")
    .gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("started_at", { ascending: false });

  if (statsError) return jsonError("Scheduler summary is unavailable.", 503);

  // Compute per-job summary
  const jobSummary: Record<string, {
    total: number;
    success: number;
    error: number;
    running: number;
    stale: number;
    deferred: number;
    lastRun: string | null;
    lastSuccess: string | null;
    lastStatus: string | null;
  }> = {};

  for (const row of (stats ?? [])) {
    if (!jobSummary[row.job_name]) {
      jobSummary[row.job_name] = { total: 0, success: 0, error: 0, running: 0, stale: 0, deferred: 0, lastRun: null, lastSuccess: null, lastStatus: null };
    }
    const s = jobSummary[row.job_name];
    s.total++;
    // Older health checks stored deferrals as errors. Preserve that history
    // while making their operational meaning visible in the dashboard.
    const status = displayStatus(row);
    if (status === "success") { s.success++; s.lastSuccess ??= row.started_at; }
    else if (status === "deferred") s.deferred++;
    else if (status === "error") s.error++;
    else if (status === "running") s.running++;
    else if (status === "stale") s.stale++;
    if (!s.lastRun) {
      s.lastRun = row.started_at;
      s.lastStatus = status;
    }
  }

  return jsonOk({ runs: (data ?? []).map((row: { status: string; started_at: string; metadata?: unknown }) =>
    ({ ...row, status: displayStatus(row) })), summary: jobSummary });
}
