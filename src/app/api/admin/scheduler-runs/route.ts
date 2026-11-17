import { jsonPrivateOk as jsonOk } from "@/lib/api/response";
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

  // Auto-cleanup: mark runs stuck in 'running' for >2h as 'stale'
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("scheduler_runs") as any)
    .update({ status: "stale", finished_at: new Date().toISOString() })
    .eq("status", "running")
    .lt("started_at", twoHoursAgo);

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
    return Response.json({ error: dbError.message }, { status: 500 });
  }

  // Also fetch summary stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stats } = await (supabase.from("scheduler_runs") as any)
    .select("job_name, status, started_at, metadata")
    .gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("started_at", { ascending: false });

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
    const status = parseSchedulerMetadata(row.metadata)?.outcome === 'deferred' ? 'deferred' : row.status;
    if (status === "success") { s.success++; s.lastSuccess ??= row.started_at; }
    else if (status === "deferred") s.deferred++;
    else if (row.status === "error") s.error++;
    else if (row.status === "running") s.running++;
    else if (row.status === "stale") s.stale++;
    if (!s.lastRun) {
      s.lastRun = row.started_at;
      s.lastStatus = status;
    }
  }

  return jsonOk({ runs: (data ?? []).map((row: { status: string; metadata?: unknown }) =>
    parseSchedulerMetadata(row.metadata)?.outcome === 'deferred' ? { ...row, status: 'deferred' } : row), summary: jobSummary });
}
