/**
 * Apply migration 012: Create scheduler_runs observability table
 *
 * Run: node scripts/apply-migration-012.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envContent = readFileSync(resolve(__dirname, "../.env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — running on Heroku with Config Vars
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: { rejectUnauthorized: false } });

console.log("🔧 Applying migration 012: scheduler_runs table...\n");

try {
  await sql`
    CREATE TABLE IF NOT EXISTS scheduler_runs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_name     TEXT NOT NULL,
      started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at  TIMESTAMPTZ,
      status       TEXT NOT NULL DEFAULT 'running',  -- running | success | error
      duration_ms  INTEGER,
      rows_scanned INTEGER DEFAULT 0,
      rows_created INTEGER DEFAULT 0,
      rows_updated INTEGER DEFAULT 0,
      rows_skipped INTEGER DEFAULT 0,
      error_message TEXT,
      metadata     JSONB DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Index for quick lookups by job name + recency
  await sql`
    CREATE INDEX IF NOT EXISTS idx_scheduler_runs_job_name
    ON scheduler_runs (job_name, started_at DESC)
  `;

  // Auto-cleanup: keep only last 90 days of runs
  // (Can be triggered by a periodic job or Postgres extension)

  console.log("✅ scheduler_runs table created successfully.");
  console.log("   Columns: id, job_name, started_at, finished_at, status,");
  console.log("            duration_ms, rows_scanned/created/updated/skipped,");
  console.log("            error_message, metadata");
} catch (err) {
  if (err.message?.includes("already exists")) {
    console.log("ℹ️  scheduler_runs table already exists, skipping.");
  } else {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

await sql.end();
console.log("\n✅ Migration 012 complete.");
