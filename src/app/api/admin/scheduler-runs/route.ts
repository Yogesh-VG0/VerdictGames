import { jsonOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const jobName = searchParams.get("job") || null;

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
    .select("job_name, status, started_at")
    .gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("started_at", { ascending: false });

  // Compute per-job summary
  const jobSummary: Record<string, {
    total: number;
    success: number;
    error: number;
    running: number;
    lastRun: string | null;
    lastStatus: string | null;
  }> = {};

  for (const row of (stats ?? [])) {
    if (!jobSummary[row.job_name]) {
      jobSummary[row.job_name] = { total: 0, success: 0, error: 0, running: 0, lastRun: null, lastStatus: null };
    }
    const s = jobSummary[row.job_name];
    s.total++;
    if (row.status === "success") s.success++;
    else if (row.status === "error") s.error++;
    else if (row.status === "running") s.running++;
    if (!s.lastRun) {
      s.lastRun = row.started_at;
      s.lastStatus = row.status;
    }
  }

  return jsonOk({ runs: data ?? [], summary: jobSummary });
}
