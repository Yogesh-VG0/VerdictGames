import { describe, expect, it, vi } from "vitest";
import { getProviderUsageSummary } from "./providerUsage";

const state = vi.hoisted(() => ({
  usage: {
    data: [
      { provider: "igdb", request_count: 4, success_count: 4, error_count: 0, total_latency_ms: 851 },
      { provider: "rawg", request_count: 56, success_count: 53, error_count: 3, total_latency_ms: 41745 },
      { provider: "steam", request_count: 10, success_count: 10, error_count: 0, total_latency_ms: 1288 },
    ],
    error: null as Error | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: () => ({
    from: (table: string) => ({
      select: () => table === "api_provider_usage"
        ? { gte: () => Promise.resolve(state.usage) }
        : Promise.resolve({
          data: state.usage.data.map(row => ({ provider: row.provider, is_enabled: true })),
          error: null,
        }),
    }),
  }),
}));

describe("provider usage reporting", () => {
  it("weights successful-request latency by its exact sample count", async () => {
    const report = await getProviderUsageSummary();
    expect(report.overallLatencyMs).toBe(655);
    expect(report.reportingTimezone).toBe("UTC");
    expect(report.providers.find(row => row.provider === "rawg")).toMatchObject({
      todayRequests: 56, todaySuccess: 53, todayErrors: 3, avgLatencyMs: 788,
    });
  });

  it("propagates telemetry read failures instead of displaying zero activity", async () => {
    state.usage.error = new Error("synthetic database error");
    try {
      await expect(getProviderUsageSummary()).rejects.toThrow("Provider usage query failed");
    } finally {
      state.usage.error = null;
    }
  });
});
