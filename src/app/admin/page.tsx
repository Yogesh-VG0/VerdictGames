"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface AdminStats {
  totalGames: number;
  totalReviews: number;
  totalUsers: number;
}

async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats");
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch stats");
}

export default function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-secondary mt-1">Overview of your verdict.games database</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total Games",
            value: stats.data?.totalGames,
            icon: "🎮",
            color: "text-pixel-cyan",
            href: "/admin/games",
          },
          {
            label: "Total Reviews",
            value: stats.data?.totalReviews,
            icon: "📝",
            color: "text-pixel-green",
            href: "/admin/reviews",
          },
          {
            label: "Total Users",
            value: stats.data?.totalUsers,
            icon: "👥",
            color: "text-accent",
            href: "#",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-white/[0.08] bg-surface p-5 hover:border-white/[0.15] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
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

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/admin/games"
            className="rounded-2xl border border-white/[0.08] bg-surface p-4 hover:border-accent/30 transition-all group"
          >
            <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
              Edit Game Pages
            </h3>
            <p className="text-xs text-tertiary mt-1">
              Update descriptions, verdicts, pros/cons, and media for any game
            </p>
          </Link>
          <Link
            href="/admin/reviews"
            className="rounded-2xl border border-white/[0.08] bg-surface p-4 hover:border-accent/30 transition-all group"
          >
            <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
              Write Reviews
            </h3>
            <p className="text-xs text-tertiary mt-1">
              Create editorial reviews or moderate community reviews
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
