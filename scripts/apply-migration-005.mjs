/**
 * Apply migration 005: Admin manual override fields on games table
 *
 * Run: node scripts/apply-migration-005.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: "require" });

async function run() {
  try {
    const migrationPath = resolve(__dirname, "../supabase/migrations/005_admin_overrides.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    console.log("🔄 Applying migration 005: Admin Override Fields...");
    await sql.unsafe(migrationSql);
    console.log("✅ Migration 005 applied successfully!");

    const cols = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'games'
        AND column_name IN ('is_featured_manual', 'is_trending_manual', 'manual_score')
      ORDER BY column_name;
    `;
    console.log("\n📋 New columns:");
    for (const c of cols) {
      console.log(`  ${c.column_name}: ${c.data_type} (default: ${c.column_default ?? "null"})`);
    }
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
