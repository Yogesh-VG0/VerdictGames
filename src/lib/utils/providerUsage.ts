/**
 * API Provider Usage Tracking
 * 
 * Tracks API calls to external providers for budget monitoring.
 * Records hourly aggregated metrics: request count, success/error, latency.
 * 
 * PERFORMANCE: All tracking is fire-and-forget (non-blocking).
 * SECURITY: Input validation, sanitization, bounded buffers.
 */

import { getServerSupabase } from "@/lib/supabase/server";

// Valid providers - strict allowlist for security
const VALID_PROVIDERS = [
  "rawg", "igdb", "steam", "gxcorner", "cheapshark",
  "hltb", "wikipedia", "googleplay", "appstore"
] as const;

export type Provider = typeof VALID_PROVIDERS[number];

interface UsageRecord {
  provider: Provider;
  endpoint: string;
  success: boolean;
  latencyMs: number;
}

interface ProviderBudget {
  provider: string;
  daily_limit: number | null;
  hourly_limit: number | null;
  monthly_limit: number | null;
  is_enabled: boolean;
}

interface UsageRow {
  provider: string;
  request_count: number;
  success_count: number;
  error_count: number;
  total_latency_ms: number;
}

// In-memory buffer for batching writes
const usageBuffer: UsageRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushingNow = false; // Prevent concurrent flushes

// Performance tuning constants
const FLUSH_INTERVAL_MS = 10000; // Flush every 10 seconds (reduced DB writes)
const MAX_BUFFER_SIZE = 100; // Buffer up to 100 records
const MAX_ENDPOINT_LENGTH = 100; // Truncate long endpoint names
const MAX_LATENCY_MS = 300000; // Cap latency at 5 minutes (edge case protection)

/**
 * Validate and sanitize provider input.
 */
function isValidProvider(p: string): p is Provider {
  return VALID_PROVIDERS.includes(p as Provider);
}

/**
 * Sanitize endpoint string - alphanumeric, slashes, dashes, underscores only.
 */
function sanitizeEndpoint(endpoint: string): string {
  if (!endpoint || typeof endpoint !== "string") return "unknown";
  return endpoint
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .slice(0, MAX_ENDPOINT_LENGTH) || "unknown";
}

/**
 * Record an API call to a provider.
 * COMPLETELY NON-BLOCKING - returns immediately.
 * Batches writes to reduce DB load.
 */
export function recordProviderUsage(
  provider: Provider,
  endpoint: string,
  success: boolean,
  latencyMs: number
): void {
  // Input validation
  if (!isValidProvider(provider)) return;
  
  // Sanitize and bound inputs
  const safeEndpoint = sanitizeEndpoint(endpoint);
  const safeLatency = Math.max(0, Math.min(latencyMs, MAX_LATENCY_MS));
  
  // Prevent buffer overflow (memory protection)
  if (usageBuffer.length >= MAX_BUFFER_SIZE * 2) {
    // Buffer too large - drop oldest entries
    usageBuffer.splice(0, MAX_BUFFER_SIZE);
  }
  
  usageBuffer.push({ 
    provider, 
    endpoint: safeEndpoint, 
    success: Boolean(success), 
    latencyMs: Math.round(safeLatency) 
  });

  // Flush if buffer is full (fire-and-forget)
  if (usageBuffer.length >= MAX_BUFFER_SIZE && !isFlushingNow) {
    void flushUsageBufferAsync();
    return;
  }

  // Start timer for periodic flush (fire-and-forget)
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      void flushUsageBufferAsync();
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush the usage buffer to the database.
 * ASYNC FIRE-AND-FORGET - never blocks the caller.
 */
async function flushUsageBufferAsync(): Promise<void> {
  // Prevent concurrent flushes
  if (isFlushingNow) return;
  isFlushingNow = true;

  try {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (usageBuffer.length === 0) {
      isFlushingNow = false;
      return;
    }

    // Take current buffer and reset
    const records = [...usageBuffer];
    usageBuffer.length = 0;

    // Aggregate by provider+endpoint within the current hour
    const hourBucket = new Date();
    hourBucket.setMinutes(0, 0, 0);
    const hourBucketISO = hourBucket.toISOString();

    const aggregated = new Map<string, {
      provider: Provider;
      endpoint: string;
      requestCount: number;
      successCount: number;
      errorCount: number;
      totalLatencyMs: number;
    }>();

    for (const r of records) {
      const key = `${r.provider}:${r.endpoint}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.requestCount++;
        if (r.success) {
          existing.successCount++;
          existing.totalLatencyMs += r.latencyMs;
        } else {
          existing.errorCount++;
        }
      } else {
        aggregated.set(key, {
          provider: r.provider,
          endpoint: r.endpoint,
          requestCount: 1,
          successCount: r.success ? 1 : 0,
          errorCount: r.success ? 0 : 1,
          totalLatencyMs: r.success ? r.latencyMs : 0,
        });
      }
    }

    // Upsert to database using raw insert with on-conflict update
    const supabase = getServerSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usageTable = supabase.from("api_provider_usage") as any;
    
    for (const [, agg] of aggregated) {
      await usageTable.upsert({
        provider: agg.provider,
        endpoint: agg.endpoint,
        hour_bucket: hourBucketISO,
        request_count: agg.requestCount,
        success_count: agg.successCount,
        error_count: agg.errorCount,
        total_latency_ms: agg.totalLatencyMs,
      }, {
        onConflict: "provider,endpoint,hour_bucket",
        ignoreDuplicates: false,
      });
    }
  } catch (err) {
    // Best effort - don't break the app if tracking fails
    console.warn("[ProviderUsage] Failed to flush usage:", (err as Error).message);
  } finally {
    isFlushingNow = false;
  }
}

/**
 * Wrapper for tracking API calls.
 * Use this to wrap external API calls for automatic tracking.
 */
export async function withProviderTracking<T>(
  provider: Provider,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    recordProviderUsage(provider, endpoint, true, Date.now() - start);
    return result;
  } catch (err) {
    recordProviderUsage(provider, endpoint, false, Date.now() - start);
    throw err;
  }
}

/**
 * Check if a provider is within budget.
 * Returns { allowed: boolean, reason?: string }
 */
export async function checkProviderBudget(
  provider: Provider
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  try {
    const supabase = getServerSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const budgetTable = supabase.from("api_provider_budgets") as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usageTable = supabase.from("api_provider_usage") as any;

    // Get budget limits
    const { data: budget } = await budgetTable
      .select("*")
      .eq("provider", provider)
      .single() as { data: ProviderBudget | null };

    if (!budget) {
      return { allowed: true }; // No budget configured = unlimited
    }

    if (!budget.is_enabled) {
      return { allowed: false, reason: `Provider ${provider} is disabled` };
    }

    // Get current hour's usage
    const hourBucket = new Date();
    hourBucket.setMinutes(0, 0, 0);

    const { data: hourlyUsage } = await usageTable
      .select("request_count")
      .eq("provider", provider)
      .eq("hour_bucket", hourBucket.toISOString()) as { data: Array<{ request_count: number }> | null };

    const hourlyTotal = (hourlyUsage ?? []).reduce((sum: number, r: { request_count: number }) => sum + (r.request_count ?? 0), 0);

    if (budget.hourly_limit && hourlyTotal >= budget.hourly_limit) {
      return {
        allowed: false,
        reason: `Hourly limit reached (${hourlyTotal}/${budget.hourly_limit})`,
        remaining: 0,
      };
    }

    // Get today's usage
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const { data: dailyUsage } = await usageTable
      .select("request_count")
      .eq("provider", provider)
      .gte("hour_bucket", dayStart.toISOString()) as { data: Array<{ request_count: number }> | null };

    const dailyTotal = (dailyUsage ?? []).reduce((sum: number, r: { request_count: number }) => sum + (r.request_count ?? 0), 0);

    if (budget.daily_limit && dailyTotal >= budget.daily_limit) {
      return {
        allowed: false,
        reason: `Daily limit reached (${dailyTotal}/${budget.daily_limit})`,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      remaining: budget.daily_limit ? budget.daily_limit - dailyTotal : undefined,
    };
  } catch (err) {
    console.warn("[ProviderUsage] Budget check failed:", (err as Error).message);
    return { allowed: true }; // Fail open
  }
}

/**
 * Get usage summary for all providers.
 */
export async function getProviderUsageSummary(): Promise<{
  providers: Array<{
    provider: string;
    todayRequests: number;
    todaySuccess: number;
    todayErrors: number;
    avgLatencyMs: number;
    dailyLimit: number | null;
    hourlyLimit: number | null;
    isEnabled: boolean;
    percentUsed: number | null;
  }>;
}> {
  try {
    const supabase = getServerSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const budgetTable = supabase.from("api_provider_budgets") as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usageTable = supabase.from("api_provider_usage") as any;

    // Get today's start
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    // Get all budgets
    const { data: budgets } = await budgetTable
      .select("*") as { data: ProviderBudget[] | null };

    // Get today's usage per provider
    const { data: usage } = await usageTable
      .select("provider, request_count, success_count, error_count, total_latency_ms")
      .gte("hour_bucket", dayStart.toISOString()) as { data: UsageRow[] | null };

    // Aggregate usage by provider
    const usageByProvider = new Map<string, {
      requests: number;
      success: number;
      errors: number;
      totalLatency: number;
    }>();

    for (const u of usage ?? []) {
      const existing = usageByProvider.get(u.provider);
      if (existing) {
        existing.requests += u.request_count ?? 0;
        existing.success += u.success_count ?? 0;
        existing.errors += u.error_count ?? 0;
        existing.totalLatency += u.total_latency_ms ?? 0;
      } else {
        usageByProvider.set(u.provider, {
          requests: u.request_count ?? 0,
          success: u.success_count ?? 0,
          errors: u.error_count ?? 0,
          totalLatency: u.total_latency_ms ?? 0,
        });
      }
    }

    // Build summary
    const providers = (budgets ?? []).map((b) => {
      const u = usageByProvider.get(b.provider) ?? { requests: 0, success: 0, errors: 0, totalLatency: 0 };
      return {
        provider: b.provider,
        todayRequests: u.requests,
        todaySuccess: u.success,
        todayErrors: u.errors,
        avgLatencyMs: u.success > 0 ? Math.round(u.totalLatency / u.success) : 0,
        dailyLimit: b.daily_limit,
        hourlyLimit: b.hourly_limit,
        isEnabled: b.is_enabled,
        percentUsed: b.daily_limit ? Math.round((u.requests / b.daily_limit) * 100) : null,
      };
    });

    return { providers };
  } catch (err) {
    console.warn("[ProviderUsage] Failed to get summary:", (err as Error).message);
    return { providers: [] };
  }
}
