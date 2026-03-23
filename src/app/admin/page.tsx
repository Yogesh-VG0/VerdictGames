"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Gamepad2, FileText, Users, Plus, PenLine, Pencil, ListPlus, Loader2, Database, ChevronDown } from "lucide-react";
import { useState, useCallback, type ReactNode } from "react";

interface AdminStats {
  totalGames: number;
  totalReviews: number;
  totalUsers: number;
}

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_changes: Record<string, { old: unknown; new: unknown }>;
  edited_by: string;
  edited_at: string;
  reason: string | null;
}

async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats");
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch stats");
}

async function fetchRecentActivity(): Promise<AuditEntry[]> {
  const res = await fetch("/api/admin/audit");
  const json = await res.json();
  if (json.success) return json.data;
  return [];
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAction(entry: AuditEntry): string {
  const fields = Object.keys(entry.field_changes || {});
  if (entry.action === "create") return `Created ${entry.entity_type}`;
  if (fields.length === 0) return `Updated ${entry.entity_type}`;
  if (fields.length <= 2) return `Updated ${fields.join(", ")}`;
  return `Updated ${fields.length} fields`;
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "(empty)";
  if (Array.isArray(val)) return val.length === 0 ? "(empty)" : val.join(", ");
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const str = String(val);
  return str.length > 80 ? str.slice(0, 80) + "…" : str;
}

function ActivityLog({ entries, isLoading }: { entries: AuditEntry[]; isLoading: boolean }) {
  const [visibleCount, setVisibleCount] = useState(15);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-surface overflow-hidden p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-tertiary">No admin activity logged yet.</p>
        <p className="text-xs text-tertiary mt-1">Edits to games will appear here.</p>
      </div>
    );
  }

  const visible = entries.slice(0, visibleCount);
  const hasMore = entries.length > visibleCount;

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="divide-y divide-border">
        {visible.map((entry) => (
          <AuditEntryRow key={entry.id} entry={entry} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + 15)}
          className="w-full px-4 py-3 text-xs font-medium text-accent hover:text-accent-hover hover:bg-surface-2 transition-colors border-t border-border"
        >
          Load more ({entries.length - visibleCount} remaining)
        </button>
      )}
      {!hasMore && entries.length > 15 && (
        <div className="px-4 py-2 text-center border-t border-border">
          <span className="text-[10px] text-tertiary">Showing all {entries.length} entries</span>
        </div>
      )}
    </div>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const fields = Object.keys(entry.field_changes || {});
  const hasChanges = fields.length > 0;

  return (
    <div className="hover:bg-surface-2 transition-colors">
      <div
        className={`px-4 py-3 flex items-start gap-3 ${hasChanges ? "cursor-pointer" : ""}`}
        onClick={() => hasChanges && setExpanded(!expanded)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          entry.action === "create" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
        }`}>
          {entry.action === "create" ? <Plus className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium">
            {formatAction(entry)}
          </p>
          {hasChanges && (
            <p className="text-[10px] text-tertiary mt-0.5">
              Changed: {fields.map(f => f.replace(/_/g, " ")).join(", ")}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-tertiary">{entry.edited_by.includes("@") ? entry.edited_by.split("@")[0] : entry.edited_by}</span>
            <span className="text-[10px] text-tertiary">·</span>
            <span className="text-[10px] text-tertiary">{formatTimeAgo(entry.edited_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.entity_type === "game" && (
            <Link
              href={`/admin/games/${entry.entity_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-accent hover:text-accent-hover"
            >
              Edit →
            </Link>
          )}
          {hasChanges && (
            <ChevronDown className={`w-3.5 h-3.5 text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`} />
          )}
        </div>
      </div>
      {expanded && hasChanges && (
        <div className="px-4 pb-3 pl-15">
          <div className="ml-11 rounded-lg border border-border bg-surface-2 overflow-hidden text-[11px]">
            {fields.map((field) => {
              const change = entry.field_changes[field];
              return (
                <div key={field} className="flex border-b border-border/50 last:border-0">
                  <div className="w-28 shrink-0 px-2.5 py-1.5 bg-surface font-medium text-secondary capitalize">
                    {field.replace(/_/g, " ")}
                  </div>
                  <div className="flex-1 px-2.5 py-1.5 space-y-0.5">
                    <div className="text-danger/70 line-through">{formatFieldValue(change.old)}</div>
                    <div className="text-pixel-green">{formatFieldValue(change.new)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    staleTime: 30_000,
  });

  const activity = useQuery({
    queryKey: ["admin-activity"],
    queryFn: fetchRecentActivity,
    staleTime: 5_000,
    refetchOnMount: "always",
  });

  const seedListsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/seed-lists", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Seed failed");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-secondary mt-1">Overview of your verdict.games database</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Total Games", value: stats.data?.totalGames, icon: <Gamepad2 className="w-5 h-5" /> as ReactNode, color: "text-pixel-cyan", href: "/admin/games" },
          { label: "Total Reviews", value: stats.data?.totalReviews, icon: <FileText className="w-5 h-5" /> as ReactNode, color: "text-pixel-green", href: "/admin/reviews" },
          { label: "Total Users", value: stats.data?.totalUsers, icon: <Users className="w-5 h-5" /> as ReactNode, color: "text-accent", href: "/admin/users" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-border bg-surface p-4 sm:p-5 hover:border-border-hover hover:shadow-lg transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-accent">{stat.icon}</span>
              <span className="text-[10px] text-tertiary uppercase tracking-wider font-medium group-hover:text-accent transition-colors">
                View →
              </span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${stat.color}`}>
              {stats.isLoading ? (
                <span className="animate-pulse bg-white/5 rounded-lg inline-block w-16 h-8" />
              ) : (
                (stat.value ?? 0).toLocaleString()
              )}
            </p>
            <p className="text-xs text-secondary mt-1">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/admin/games/new"
              className="block rounded-2xl border border-accent/20 bg-accent/5 p-4 hover:border-accent/40 hover:bg-accent/10 transition-all group"
            >
              <h3 className="text-sm font-semibold text-accent group-hover:text-accent-hover transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add New Game
              </h3>
              <p className="text-xs text-tertiary mt-1">
                Create via title lookup, source URL, or manual provisional entry
              </p>
            </Link>
            {[
              { href: "/admin/games", label: "Edit Game Pages", desc: "Update descriptions, verdicts, pros/cons, and media", icon: <PenLine className="w-4 h-4 inline mr-1.5 opacity-60" /> as ReactNode },
              { href: "/admin/reviews", label: "Write Reviews", desc: "Create editorial reviews or moderate community reviews", icon: <FileText className="w-4 h-4 inline mr-1.5 opacity-60" /> as ReactNode },
              { href: "/admin/users", label: "Manage Users", desc: "View profiles, review counts, library activity", icon: <Users className="w-4 h-4 inline mr-1.5 opacity-60" /> as ReactNode },
            ].map(q => (
              <Link
                key={q.href}
                href={q.href}
                className="block rounded-2xl border border-border bg-surface p-4 hover:border-accent/30 transition-all group"
              >
                <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors flex items-center">
                  {(q as { icon?: ReactNode }).icon}{q.label}
                </h3>
                <p className="text-xs text-tertiary mt-1">{q.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Admin Activity */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
          <ActivityLog entries={activity.data ?? []} isLoading={activity.isLoading} />
        </div>
      </div>

      {/* Seed Content */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-500" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Seed Content</span>
        </h2>
        <p className="text-xs text-tertiary">Populate your site with starter content for launch.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => seedListsMutation.mutate()}
            disabled={seedListsMutation.isPending}
            className="rounded-2xl border border-border bg-surface p-4 hover:border-accent/30 transition-all text-left disabled:opacity-50"
          >
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {seedListsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4 text-accent" />}
              {seedListsMutation.isPending ? "Seeding Lists..." : "Seed Editorial Lists"}
            </h3>
            <p className="text-xs text-tertiary mt-1">
              Creates 10 curated lists from your existing game database.
            </p>
            {seedListsMutation.isSuccess && (
              <p className="text-xs text-pixel-green mt-2">Done! Check the Lists page.</p>
            )}
            {seedListsMutation.isError && (
              <p className="text-xs text-danger mt-2">Failed — check console for details.</p>
            )}
          </button>
          <Link
            href="/admin/reviews"
            className="rounded-2xl border border-border bg-surface p-4 hover:border-accent/30 transition-all"
          >
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <PenLine className="w-4 h-4 text-accent" /> Create Community Reviews
            </h3>
            <p className="text-xs text-tertiary mt-1">
              Write editorial reviews to populate the Reviews page.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
