/**
 * Apply migration 001: Multi-Source Data Fields
 *
 * Run: node scripts/apply-migration-001.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env manually
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
    const migrationPath = resolve(__dirname, "../supabase/migrations/001_multi_source.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    console.log("🔄 Applying migration 001: Multi-Source Data Fields...");
    await sql.unsafe(migrationSql);
    console.log("✅ Migration applied successfully!");

    // Verify new columns exist
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'games' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    console.log(`\n📋 Games table now has ${cols.length} columns:`);
    console.log(cols.map((c) => c.column_name).join(", "));
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
