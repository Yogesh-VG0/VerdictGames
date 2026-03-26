"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Filter,
  BarChart3,
  Calendar,
} from "lucide-react";

interface SchedulerRun {
  id: string;
  job_name: string;
  status: "running" | "success" | "error";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  rows_scanned: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

interface JobSummary {
  total: number;
  success: number;
  error: number;
  running: number;
  lastRun: string | null;
  lastStatus: string | null;
}

const JOB_LABELS: Record<string, { label: string; description: string }> = {
  "refresh-trending": { label: "Refresh Trending", description: "Steam player counts + trending/featured flags" },
  "discover-games": { label: "Discover Games", description: "Find and ingest new games from RAWG" },
  "re-enrich": { label: "Re-enrich", description: "Refresh stale game enrichment data" },
  "backfill-games": { label: "Backfill Games", description: "Ingest missing games by year range" },
  "backfill-mobile-android": { label: "Backfill Android", description: "Verify Google Play store listings" },
  "backfill-mobile-ios": { label: "Backfill iOS", description: "Verify App Store listings" },
  "seed-curated-lists": { label: "Seed Lists", description: "Refresh editorial curated lists" },
};

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
  return <Clock className="w-4 h-4 text-secondary" />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        status === "success" && "bg-green-500/10 text-green-500",
        status === "error" && "bg-red-500/10 text-red-500",
        status === "running" && "bg-amber-500/10 text-amber-500"
      )}
    >
      <StatusIcon status={status} />
      {status}
    </span>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RunRow({ run }: { run: SchedulerRun }) {
  const [expanded, setExpanded] = useState(false);
  const jobInfo = JOB_LABELS[run.job_name] || { label: run.job_name, description: "" };
  const hasDetails = run.metadata || run.error_message || run.rows_scanned > 0 || run.rows_created > 0;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          "w-full text-left px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 transition-colors",
          hasDetails && "hover:bg-surface-2 cursor-pointer",
          !hasDetails && "cursor-default"
        )}
      >
        {hasDetails ? (
          expanded ? <ChevronDown className="w-4 h-4 text-tertiary shrink-0" /> : <ChevronRight className="w-4 h-4 text-tertiary shrink-0" />
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm text-foreground truncate">{jobInfo.label}</span>
            <StatusBadge status={run.status} />
          </div>

          <div className="flex items-center gap-3 text-xs text-tertiary">
            <span title={formatTimestamp(run.started_at)}>{formatRelative(run.started_at)}</span>
            <span>{formatDuration(run.duration_ms)}</span>
            {(run.rows_created > 0 || run.rows_updated > 0) && (
              <span className="text-green-500">
                +{run.rows_created > 0 ? `${run.rows_created} created` : `${run.rows_updated} updated`}
              </span>
            )}
            {run.rows_skipped > 0 && (
              <span className="text-secondary">{run.rows_skipped} skipped</span>
            )}
            {run.error_message && (
              <span className="text-red-500 truncate max-w-[200px]">{run.error_message}</span>
            )}
          </div>
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="px-4 sm:px-12 pb-3 space-y-2">
          {/* Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Scanned", value: run.rows_scanned },
              { label: "Created", value: run.rows_created },
              { label: "Updated", value: run.rows_updated },
              { label: "Skipped", value: run.rows_skipped },
            ].map((c) => (
              <div key={c.label} className="bg-surface-2 rounded-lg px-3 py-2">
                <div className="text-[11px] text-tertiary uppercase tracking-wider">{c.label}</div>
                <div className="text-sm font-semibold text-foreground">{c.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Timestamps */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-tertiary">
            <span>Started: {formatTimestamp(run.started_at)}</span>
            {run.finished_at && <span>Finished: {formatTimestamp(run.finished_at)}</span>}
            {run.duration_ms !== null && <span>Duration: {formatDuration(run.duration_ms)}</span>}
          </div>

          {/* Error */}
          {run.error_message && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 font-mono whitespace-pre-wrap break-all">
              {run.error_message}
            </div>
          )}

          {/* Metadata */}
          {run.metadata && Object.keys(run.metadata).length > 0 && (
            <div className="bg-surface-2 rounded-lg px-3 py-2">
              <div className="text-[11px] text-tertiary uppercase tracking-wider mb-1">Metadata</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                {Object.entries(run.metadata).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-1.5">
                    <span className="text-tertiary">{key}:</span>
                    <span className="text-foreground font-medium truncate">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchedulerPage() {
  const [filter, setFilter] = useState<string | null>(null);

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-scheduler", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filter) params.set("job", filter);
      const res = await fetch(`/api/admin/scheduler-runs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch scheduler runs");
      return res.json() as Promise<{ runs: SchedulerRun[]; summary: Record<string, JobSummary> }>;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const runs = data?.runs ?? [];
  const summary = data?.summary ?? {};
  const jobNames = Object.keys(summary).sort();

  // Overall stats
  const totalRuns = Object.values(summary).reduce((a, s) => a + s.total, 0);
  const totalSuccess = Object.values(summary).reduce((a, s) => a + s.success, 0);
  const totalErrors = Object.values(summary).reduce((a, s) => a + s.error, 0);
  const totalRunning = Object.values(summary).reduce((a, s) => a + s.running, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-accent" />
            Scheduler Logs
          </h1>
          <p className="text-sm text-secondary mt-1">
            Monitor Heroku scheduler job runs and their results
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm text-secondary hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total (7d)", value: totalRuns, icon: BarChart3, color: "text-accent" },
          { label: "Succeeded", value: totalSuccess, icon: CheckCircle2, color: "text-green-500" },
          { label: "Failed", value: totalErrors, icon: XCircle, color: "text-red-500" },
          { label: "Running", value: totalRunning, icon: Loader2, color: "text-amber-500" },
        ].map((card) => (
          <div key={card.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-tertiary mb-1">
              <card.icon className={cn("w-3.5 h-3.5", card.color)} />
              {card.label}
            </div>
            <div className="text-2xl font-bold text-foreground">{isLoading ? "—" : card.value}</div>
          </div>
        ))}
      </div>

      {/* Per-Job Summary */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            Job Summary (7 days)
          </h2>
          {dataUpdatedAt > 0 && (
            <span className="text-[11px] text-tertiary">
              Updated {formatRelative(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-secondary text-sm">Loading...</div>
          ) : jobNames.length === 0 ? (
            <div className="px-4 py-8 text-center text-secondary text-sm">No scheduler runs found</div>
          ) : (
            jobNames.map((name) => {
              const s = summary[name];
              const info = JOB_LABELS[name] || { label: name, description: "" };
              const successRate = s.total > 0 ? Math.round((s.success / s.total) * 100) : 0;
              return (
                <div key={name} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-2 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{info.label}</span>
                      {s.running > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500">
                          <Loader2 className="w-3 h-3 animate-spin" /> running
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-tertiary">{info.description}</div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-secondary shrink-0">
                    <div className="text-right">
                      <div className="font-medium text-foreground">{s.total} runs</div>
                      <div>{successRate}% success</div>
                    </div>
                    <div className="text-right">
                      {s.lastRun && <div>{formatRelative(s.lastRun)}</div>}
                      {s.lastStatus && <StatusBadge status={s.lastStatus} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Filter + Run Log */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            Run History
          </h2>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <Filter className="w-3.5 h-3.5 text-tertiary shrink-0" />
            <button
              onClick={() => setFilter(null)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                !filter ? "bg-accent text-white" : "text-secondary hover:text-foreground hover:bg-surface-2"
              )}
            >
              All
            </button>
            {jobNames.map((name) => (
              <button
                key={name}
                onClick={() => setFilter(name === filter ? null : name)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                  filter === name ? "bg-accent text-white" : "text-secondary hover:text-foreground hover:bg-surface-2"
                )}
              >
                {JOB_LABELS[name]?.label || name}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 py-12 text-center text-secondary text-sm">Loading scheduler runs...</div>
        ) : runs.length === 0 ? (
          <div className="px-4 py-12 text-center text-secondary text-sm">No runs found</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
