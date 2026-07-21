/**
 * Shared database connection helper for scheduler scripts.
 *
 * Resolves DATABASE_URL from multiple sources:
 *   1. DATABASE_URL env var (standard PostgreSQL or explicit Supabase URI)
 *   2. SUPABASE_DB_URL env var (explicit Supabase pooler URI)
 *
 * NEVER silently falls back to localhost. Fails fast with a clear error.
 */

import postgres from "postgres";

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDbUrl() {
  // Priority 1: Explicit DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Priority 2: Explicit Supabase DB URL
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }

  return null;
}

/**
 * Create a postgres connection with proper error handling.
 * Fails immediately if no DATABASE_URL can be resolved.
 */
export function connectDb(scriptName = "scheduler") {
  const dbUrl = getDbUrl();

  if (!dbUrl) {
    console.error("═══════════════════════════════════════════");
    console.error(`  ❌ FATAL: No database connection URL found`);
    console.error(`  Script: ${scriptName}`);
    console.error("");
    console.error("  Expected one of these environment variables:");
    console.error("    DATABASE_URL           — Full Postgres connection string");
    console.error("    SUPABASE_DB_URL        — Supabase pooler connection string");
    console.error("");
    console.error("  You can find this in:");
    console.error("    Supabase Dashboard → Project Settings → Database → Connection string → URI");
    console.error("");
    console.error("  Current env vars available:");
    console.error(`    DATABASE_URL:           ${process.env.DATABASE_URL ? "SET" : "NOT SET"}`);
    console.error(`    SUPABASE_DB_URL:        ${process.env.SUPABASE_DB_URL ? "SET" : "NOT SET"}`);
    console.error("═══════════════════════════════════════════");
    process.exit(1);
  }

  // Log sanitized connection target (hostname only, no credentials)
  try {
    const url = new URL(dbUrl);
    console.log(`🔗 DB target: ${url.hostname}:${url.port || 5432} (${scriptName})`);
  } catch {
    console.log(`🔗 DB target: [could not parse URL] (${scriptName})`);
  }

  let ssl = { rejectUnauthorized: false };
  const maxConnections = parsePositiveInteger(
    process.env.SCHEDULER_DB_MAX_CONNECTIONS,
    2,
  );
  const connectTimeoutSeconds = parsePositiveInteger(
    process.env.SCHEDULER_DB_CONNECT_TIMEOUT_SECONDS,
    20,
  );
  const idleTimeoutSeconds = parsePositiveInteger(
    process.env.SCHEDULER_DB_IDLE_TIMEOUT_SECONDS,
    20,
  );

  try {
    const url = new URL(dbUrl);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      ssl = false;
    }
  } catch {
    // Keep remote-safe default when URL parsing fails.
  }

  return postgres(dbUrl, {
    ssl,
    max: maxConnections,
    connect_timeout: connectTimeoutSeconds,
    idle_timeout: idleTimeoutSeconds,
  });
}

export async function closeDb(sql, scriptName = "scheduler") {
  const closeTimeoutSeconds = parsePositiveInteger(
    process.env.SCHEDULER_DB_CLOSE_TIMEOUT_SECONDS,
    5,
  );

  try {
    await sql.end({ timeout: closeTimeoutSeconds });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠ DB close warning (${scriptName}): ${message}`);
  }
}
