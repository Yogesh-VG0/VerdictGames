"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle, Clock, Database, TrendingUp, Zap } from "lucide-react";

interface ProviderUsage {
  provider: string;
  todayRequests: number;
  todaySuccess: number;
  todayErrors: number;
  avgLatencyMs: number;
  dailyLimit: number | null;
  hourlyLimit: number | null;
  isEnabled: boolean;
  percentUsed: number | null;
}

interface UsageResponse {
  providers: ProviderUsage[];
}

async function fetchProviderUsage(): Promise<UsageResponse> {
  const res = await fetch("/api/admin/provider-usage");
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch provider usage");
}

function getStatusColor(provider: ProviderUsage): string {
  if (!provider.isEnabled) return "text-gray-500";
  if (provider.percentUsed !== null && provider.percentUsed >= 90) return "text-red-400";
  if (provider.percentUsed !== null && provider.percentUsed >= 70) return "text-yellow-400";
  if (provider.todayErrors > provider.todaySuccess * 0.1) return "text-orange-400";
  return "text-green-400";
}

function getLatencyColor(ms: number): string {
  if (ms === 0) return "text-gray-500";
  if (ms < 200) return "text-green-400";
  if (ms < 500) return "text-yellow-400";
  if (ms < 1000) return "text-orange-400";
  return "text-red-400";
}

export default function AdminProvidersPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-provider-usage"],
    queryFn: fetchProviderUsage,
    staleTime: 30_000,
    refetchInterval: 60_000, // Auto-refresh every minute
  });

  const providers = data?.providers ?? [];
  const totalRequests = providers.reduce((sum, p) => sum + p.todayRequests, 0);
  const totalErrors = providers.reduce((sum, p) => sum + p.todayErrors, 0);
  const avgLatency = providers.length > 0
    ? Math.round(providers.reduce((sum, p) => sum + p.avgLatencyMs, 0) / providers.filter(p => p.avgLatencyMs > 0).length || 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-accent" />
            API Provider Usage
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            Real-time monitoring of external API providers
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium hover:bg-white/5 transition-colors"
        >
          <Activity className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-secondary text-xs font-medium mb-2">
            <TrendingUp className="w-4 h-4" />
            Today&apos;s Requests
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {totalRequests.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-secondary text-xs font-medium mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            Success Rate
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {totalRequests > 0 ? ((1 - totalErrors / totalRequests) * 100).toFixed(1) : "0.0"}%
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-secondary text-xs font-medium mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Errors
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {totalErrors.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-secondary text-xs font-medium mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Avg Latency
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {avgLatency}ms
          </p>
        </div>
      </div>

      {/* Provider Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Provider</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Requests</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden sm:table-cell">Success</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden sm:table-cell">Errors</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Latency</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Usage</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-red-400 text-sm">
                  Failed to load provider usage
                </td>
              </tr>
            ) : providers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-secondary text-sm">
                  No usage data yet. API calls will be tracked automatically.
                </td>
              </tr>
            ) : (
              providers.map((provider) => {
                const statusColor = getStatusColor(provider);
                const latencyColor = getLatencyColor(provider.avgLatencyMs);
                const successRate = provider.todayRequests > 0
                  ? ((provider.todaySuccess / provider.todayRequests) * 100).toFixed(1)
                  : "0.0";

                return (
                  <tr key={provider.provider} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Zap className={`w-4 h-4 ${statusColor}`} />
                        <span className="font-medium text-foreground uppercase">{provider.provider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {provider.todayRequests.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-400 hidden sm:table-cell">
                      {provider.todaySuccess.toLocaleString()}
                      <span className="text-tertiary text-xs ml-1">({successRate}%)</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                      <span className={provider.todayErrors > 0 ? "text-red-400" : "text-tertiary"}>
                        {provider.todayErrors.toLocaleString()}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums hidden md:table-cell ${latencyColor}`}>
                      {provider.avgLatencyMs > 0 ? `${provider.avgLatencyMs}ms` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {provider.dailyLimit ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (provider.percentUsed ?? 0) >= 90
                                  ? "bg-red-500"
                                  : (provider.percentUsed ?? 0) >= 70
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(provider.percentUsed ?? 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-secondary w-10 text-right">
                            {provider.percentUsed ?? 0}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-tertiary">∞</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {provider.isEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Disabled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Info Note */}
      <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-secondary">
        <p className="flex items-start gap-2">
          <Activity className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
          <span>
            Usage is tracked automatically for all external API calls (RAWG, IGDB, Steam, CheapShark, etc.).
            Data refreshes every minute. Budget limits can be configured in the database.
          </span>
        </p>
      </div>
    </div>
  );
}
