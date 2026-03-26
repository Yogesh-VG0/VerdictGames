"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Play,
  Terminal,
  Info,
  Zap,
  Server,
} from "lucide-react";

interface SchedulerRun {
  id: string;
  job_name: string;
  status: "running" | "success" | "error" | "stale";
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
  stale: number;
  lastRun: string | null;
  lastStatus: string | null;
}

const JOB_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  "refresh-trending": { label: "Refresh Trending", description: "Steam player counts + trending/featured flags", icon: "trending" },
  "discover-games": { label: "Discover Games", description: "Find and ingest new games from RAWG", icon: "discover" },
  "re-enrich": { label: "Re-enrich", description: "Refresh stale game enrichment data", icon: "enrich" },
  "backfill-games": { label: "Backfill Games", description: "Ingest missing games by year range", icon: "backfill" },
  "backfill-mobile-android": { label: "Backfill Android", description: "Verify Google Play store listings", icon: "android" },
  "backfill-mobile-ios": { label: "Backfill iOS", description: "Verify App Store listings", icon: "ios" },
  "seed-curated-lists": { label: "Seed Lists", description: "Refresh editorial curated lists", icon: "lists" },
};

// Heroku-only jobs can't be triggered from the web UI
const HEROKU_ONLY_JOBS = new Set(["backfill-games", "backfill-mobile-android", "backfill-mobile-ios"]);

// ── Human-readable metadata labels per job type ──
const METADATA_LABELS: Record<string, Record<string, string>> = {
  "refresh-trending": {
    totalGames: "Total games in DB",
    trending: "Games marked trending",
    elapsed: "Duration (seconds)",
    featured: "Games marked featured",
  },
  "discover-games": {
    elapsed: "Duration (seconds)",
    failed: "Failed ingestions",
    deep: "Deep mode enabled",
    queries: "RAWG API queries made",
  },
  "re-enrich": {
    elapsed: "Duration (seconds)",
    failed: "Failed re-enrichments",
    limit: "Batch size limit",
    fastPathCount: "Fast-path (recent releases)",
  },
  "backfill-games": {
    errors: "Errors encountered",
    yearFrom: "Year range start",
    yearTo: "Year range end",
    elapsed: "Duration (seconds)",
  },
  "backfill-mobile-android": {
    failed: "Failed lookups",
    elapsed: "Duration (seconds)",
    matched: "Matched listings",
  },
  "backfill-mobile-ios": {
    failed: "Failed lookups",
    elapsed: "Duration (seconds)",
    matched: "Matched listings",
  },
  "seed-curated-lists": {
    elapsed: "Duration (seconds)",
    lists_created: "Lists created",
  },
};

// ── Counter labels with context per job type ──
const COUNTER_LABELS: Record<string, { scanned: string; created: string; updated: string; skipped: string }> = {
  "refresh-trending": {
    scanned: "Steam games checked",
    created: "New games ingested",
    updated: "Player counts + flags updated",
    skipped: "Unchanged",
  },
  "discover-games": {
    scanned: "Unique games found from RAWG",
    created: "New games ingested",
    updated: "Existing games refreshed",
    skipped: "Already in database",
  },
  "re-enrich": {
    scanned: "Stale games processed",
    created: "Newly enriched",
    updated: "Games re-enriched",
    skipped: "Skipped (locked)",
  },
  "backfill-games": {
    scanned: "RAWG pages scanned",
    created: "New games ingested",
    updated: "Games updated",
    skipped: "Already existed",
  },
  "backfill-mobile-android": {
    scanned: "Games checked on Google Play",
    created: "New listings verified",
    updated: "Listings refreshed",
    skipped: "No match / already verified",
  },
  "backfill-mobile-ios": {
    scanned: "Games checked on App Store",
    created: "New listings verified",
    updated: "Listings refreshed",
    skipped: "No match / already verified",
  },
  "seed-curated-lists": {
    scanned: "List definitions processed",
    created: "Lists created",
    updated: "Lists refreshed",
    skipped: "Unchanged",
  },
};

function getRunSummaryText(run: SchedulerRun, meta: Record<string, unknown> | null): string | null {
  const { job_name, status, rows_created, rows_updated, rows_scanned, rows_skipped } = run;

  if (status === "stale") return "Run was interrupted or timed out before completing.";
  if (status === "running") return "Currently executing...";
  if (status === "error") return null; // error_message shown separately

  switch (job_name) {
    case "refresh-trending": {
      const trending = meta?.trending ?? "?";
      const total = meta?.totalGames ?? "?";
      const elapsed = meta?.elapsed ? `${Number(meta.elapsed).toFixed(0)}s` : "";
      return `Refreshed player counts for ${rows_scanned.toLocaleString()} Steam games. ${rows_updated.toLocaleString()} player counts + flags updated. ${trending} games marked trending out of ${total} total.${elapsed ? ` Completed in ${elapsed}.` : ""}`;
    }
    case "discover-games": {
      const queries = meta?.queries ?? "?";
      const failed = meta?.failed ?? 0;
      return `Fetched ${queries} RAWG lists, found ${rows_scanned.toLocaleString()} unique games. Ingested ${rows_created} new games, ${rows_skipped.toLocaleString()} already in DB.${Number(failed) > 0 ? ` ${failed} failed.` : ""}`;
    }
    case "re-enrich": {
      const limit = meta?.limit ?? "?";
      const failed = meta?.failed ?? 0;
      return `Processed ${rows_scanned} stale games (batch limit: ${limit}). Successfully re-enriched ${rows_updated} with fresh RAWG/IGDB/Steam data.${Number(failed) > 0 ? ` ${failed} failed.` : ""}`;
    }
    case "backfill-games": {
      const yFrom = meta?.yearFrom ?? "?";
      const yTo = meta?.yearTo ?? "?";
      return `Scanned RAWG for games from ${yFrom}–${yTo}. Ingested ${rows_created} new games, ${rows_skipped.toLocaleString()} already existed.`;
    }
    case "backfill-mobile-android":
      return `Checked ${rows_scanned} games against Google Play. ${rows_created > 0 ? `Verified ${rows_created} new listings.` : "No new listings."} ${rows_skipped > 0 ? `${rows_skipped} skipped (no match or already verified).` : ""}`;
    case "backfill-mobile-ios":
      return `Checked ${rows_scanned} games against App Store. ${rows_created > 0 ? `Verified ${rows_created} new listings.` : "No new listings."} ${rows_skipped > 0 ? `${rows_skipped} skipped (no match or already verified).` : ""}`;
    case "seed-curated-lists":
      return `Regenerated ${rows_updated > 0 ? rows_updated : rows_created} editorial curated lists with current game data.`;
    default:
      return null;
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
  if (status === "stale") return <Clock className="w-4 h-4 text-orange-400" />;
  return <Clock className="w-4 h-4 text-secondary" />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        status === "success" && "bg-green-500/10 text-green-500",
        status === "error" && "bg-red-500/10 text-red-500",
        status === "running" && "bg-amber-500/10 text-amber-500",
        status === "stale" && "bg-orange-400/10 text-orange-400"
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

function parseMetadata(raw: Record<string, unknown> | string | null): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function RunRow({ run }: { run: SchedulerRun }) {
  const [expanded, setExpanded] = useState(false);
  const jobInfo = JOB_LABELS[run.job_name] || { label: run.job_name, description: "" };
  const meta = parseMetadata(run.metadata);
  const hasDetails = (meta && Object.keys(meta).length > 0) || run.error_message || run.rows_scanned > 0 || run.rows_created > 0;
  const summaryText = getRunSummaryText(run, meta);
  const counterLabels = COUNTER_LABELS[run.job_name] ?? { scanned: "Scanned", created: "Created", updated: "Updated", skipped: "Skipped" };
  const metaLabels = METADATA_LABELS[run.job_name] ?? {};

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
          {/* Human-readable summary */}
          {summaryText && (
            <div className="flex gap-2 bg-accent/5 border border-accent/10 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-secondary leading-relaxed">{summaryText}</p>
            </div>
          )}

          {/* Counters with contextual labels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: counterLabels.scanned, value: run.rows_scanned },
              { label: counterLabels.created, value: run.rows_created },
              { label: counterLabels.updated, value: run.rows_updated },
              { label: counterLabels.skipped, value: run.rows_skipped },
            ].map((c) => (
              <div key={c.label} className="bg-surface-2 rounded-lg px-3 py-2">
                <div className="text-[11px] text-tertiary uppercase tracking-wider leading-tight">{c.label}</div>
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

          {/* Metadata with human-readable labels */}
          {meta && Object.keys(meta).length > 0 && (
            <div className="bg-surface-2 rounded-lg px-3 py-2">
              <div className="text-[11px] text-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Terminal className="w-3 h-3" /> Run Details
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                {Object.entries(meta).map(([key, value]) => {
                  const label = metaLabels[key] || key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
                  return (
                    <div key={key} className="flex items-baseline gap-1.5">
                      <span className="text-tertiary capitalize">{label}:</span>
                      <span className="text-foreground font-medium truncate">
                        {typeof value === "boolean" ? (value ? "Yes" : "No") :
                          typeof value === "object" ? JSON.stringify(value) :
                          key === "elapsed" ? `${Number(value).toFixed(1)}s` :
                          String(value)}
                      </span>
                    </div>
                  );
                })}
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
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-scheduler", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filter) params.set("job", filter);
      const res = await fetch(`/api/admin/scheduler-runs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch scheduler runs");
      const json = await res.json();
      const payload = json.success ? json.data : json;
      return payload as { runs: SchedulerRun[]; summary: Record<string, JobSummary> };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const triggerMutation = useMutation({
    mutationFn: async (jobName: string) => {
      const res = await fetch("/api/admin/scheduler-runs/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: jobName }),
      });
      const json = await res.json();
      return json.success ? json.data : json;
    },
    onSuccess: (data) => {
      if (data.herokuOnly) {
        setTriggerMsg(data.message);
      } else if (data.success === false) {
        setTriggerMsg(`Failed: ${data.message}`);
      } else {
        setTriggerMsg(`${data.job} completed successfully`);
        queryClient.invalidateQueries({ queryKey: ["admin-scheduler"] });
      }
      setTimeout(() => setTriggerMsg(null), 15000);
    },
    onError: (err) => {
      setTriggerMsg(`Trigger failed: ${(err as Error).message}`);
      setTimeout(() => setTriggerMsg(null), 10000);
    },
  });

  const runs = data?.runs ?? [];
  const summary = data?.summary ?? {};
  const jobNames = Object.keys(summary).sort();

  // All known jobs (even if they haven't run yet)
  const allJobNames = [...new Set([...Object.keys(JOB_LABELS), ...jobNames])].sort();

  // Overall stats
  const totalRuns = Object.values(summary).reduce((a, s) => a + s.total, 0);
  const totalSuccess = Object.values(summary).reduce((a, s) => a + s.success, 0);
  const totalErrors = Object.values(summary).reduce((a, s) => a + s.error, 0);
  const totalStale = Object.values(summary).reduce((a, s) => a + s.stale, 0);
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
            Monitor scheduler job runs, view detailed results, and trigger manual runs
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

      {/* Trigger message */}
      {triggerMsg && (
        <div className={cn(
          "rounded-xl px-4 py-3 text-sm whitespace-pre-line border",
          triggerMsg.startsWith("Failed") || triggerMsg.startsWith("Trigger failed")
            ? "bg-red-500/10 border-red-500/20 text-red-400"
            : triggerMsg.includes("Heroku") || triggerMsg.includes("heroku")
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-green-500/10 border-green-500/20 text-green-500"
        )}>
          {triggerMsg}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total (7d)", value: totalRuns, icon: BarChart3, color: "text-accent" },
          { label: "Succeeded", value: totalSuccess, icon: CheckCircle2, color: "text-green-500" },
          { label: "Failed", value: totalErrors, icon: XCircle, color: "text-red-500" },
          { label: "Stale / Running", value: `${totalStale} / ${totalRunning}`, icon: Clock, color: "text-orange-400" },
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

      {/* Per-Job Summary with trigger buttons */}
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
          ) : allJobNames.length === 0 ? (
            <div className="px-4 py-8 text-center text-secondary text-sm">No scheduler runs found</div>
          ) : (
            allJobNames.map((name) => {
              const s = summary[name] ?? { total: 0, success: 0, error: 0, running: 0, stale: 0, lastRun: null, lastStatus: null };
              const info = JOB_LABELS[name] || { label: name, description: "" };
              const completedRuns = s.total - s.stale - s.running;
              const successRate = completedRuns > 0 ? Math.round((s.success / completedRuns) * 100) : 0;
              const isHerokuOnly = HEROKU_ONLY_JOBS.has(name);
              const isTriggering = triggerMutation.isPending && triggerMutation.variables === name;
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
                      {isHerokuOnly && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400" title="This job runs on Heroku and cannot be triggered from the dashboard">
                          <Server className="w-3 h-3" /> Heroku
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-tertiary">{info.description}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.total > 0 && (
                      <div className="flex items-center gap-4 text-xs text-secondary">
                        <div className="text-right">
                          <div className="font-medium text-foreground">{s.total} runs</div>
                          <div>{successRate}% success</div>
                        </div>
                        <div className="text-right">
                          {s.lastRun && <div>{formatRelative(s.lastRun)}</div>}
                          {s.lastStatus && <StatusBadge status={s.lastStatus} />}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => triggerMutation.mutate(name)}
                      disabled={triggerMutation.isPending}
                      title={isHerokuOnly ? "Show Heroku CLI command" : `Manually trigger ${info.label}`}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
                        isHerokuOnly
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
                          : "bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 hover:bg-pixel-cyan/20"
                      )}
                    >
                      {isTriggering ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Running...</>
                      ) : isHerokuOnly ? (
                        <><Terminal className="w-3 h-3" /> CLI</>
                      ) : (
                        <><Play className="w-3 h-3" /> Run</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            Quick Actions
          </h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { job: "re-enrich", label: "Re-enrich Stale Games", desc: "Refresh oldest-enriched games with fresh data from RAWG, IGDB, and Steam", color: "bg-green-500/10 text-green-500 border-green-500/20" },
            { job: "refresh-trending", label: "Refresh Trending", desc: "Update player counts and recalculate trending/featured flags", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
            { job: "discover-games", label: "Discover New Games", desc: "Search RAWG for trending, new, and top-rated games to ingest", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
            { job: "seed-curated-lists", label: "Seed Editorial Lists", desc: "Regenerate all 12 editorial curated lists from current data", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
          ].map((action) => {
            const isRunning = triggerMutation.isPending && triggerMutation.variables === action.job;
            return (
              <button
                key={action.job}
                onClick={() => triggerMutation.mutate(action.job)}
                disabled={triggerMutation.isPending}
                className={cn(
                  "text-left p-3 rounded-xl border transition-all disabled:opacity-50 hover:scale-[1.01]",
                  action.color
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  <span className="font-medium text-sm">{isRunning ? "Running..." : action.label}</span>
                </div>
                <p className="text-xs opacity-75 leading-relaxed">{action.desc}</p>
              </button>
            );
          })}
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
            {allJobNames.map((name) => (
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
