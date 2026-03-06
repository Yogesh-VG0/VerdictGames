/**
 * Apply migration 003: User Features
 * (Auth profiles link, user_games, follows, review_comments, review_votes, HLTB columns)
 *
 * Run: node scripts/apply-migration-003.mjs
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
    const migrationPath = resolve(__dirname, "../supabase/migrations/003_user_features.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    console.log("🔄 Applying migration 003: User Features...");
    await sql.unsafe(migrationSql);
    console.log("✅ Migration 003 applied successfully!");

    // Verify new tables exist
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('user_games', 'follows', 'review_comments', 'review_votes')
      ORDER BY table_name;
    `;
    console.log("\n📋 New tables:", tables.map((t) => t.table_name).join(", "));

    // Verify HLTB columns on games
    const hltbCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'games' AND column_name LIKE 'hltb%'
      ORDER BY column_name;
    `;
    console.log("📋 HLTB columns:", hltbCols.map((c) => c.column_name).join(", "));

    // Verify auth_id column on profiles
    const authCol = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'auth_id';
    `;
    console.log("📋 profiles.auth_id:", authCol.length > 0 ? "✅ exists" : "❌ missing");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
