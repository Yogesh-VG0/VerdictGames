#!/usr/bin/env node
/**
 * Apply database schema to Supabase.
 *
 * Usage:
 *   node scripts/apply-schema.mjs
 *
 * Requires DATABASE_URL or SUPABASE_DB_URL in .env or as an environment variable.
 * Get it from: Supabase Dashboard → Settings → Database → Connection string (URI)
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Match the documented Next.js setup while retaining root .env support.
for (const envFile of [".env.local", ".env"]) {
  try {
    const envPath = resolve(__dirname, "..", envFile);
    const envContent = readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // This environment file is optional.
  }
}

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(`
╔══════════════════════════════════════════════════════╗
║  Database URL not found!                             ║
║                                                      ║
║  Add one of these to your .env file:                 ║
║  SUPABASE_DB_URL=postgresql://postgres.[ref]:...     ║
║  DATABASE_URL=postgresql://postgres:[pass]@...       ║
║                                                      ║
║  Find it in Supabase Dashboard:                      ║
║    Settings → Database → Connection string (URI)     ║
║    Choose "Session" mode for the Supavisor pooler    ║
╚══════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

console.log("🔌 Connecting to database...");
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false }, max: 1 });

try {
  // Test connection
  const [{ now }] = await sql`SELECT now()`;
  console.log(`✅ Connected! Server time: ${now}`);

  const migrationsDir = resolve(__dirname, "..", "supabase", "migrations");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (migrationFiles.length === 0) {
    throw new Error("No SQL migrations found in supabase/migrations");
  }

  console.log("📦 Applying ordered migrations (schema.sql is reference-only)...");
  for (const migrationFile of migrationFiles) {
    const migrationPath = resolve(migrationsDir, migrationFile);
    const migrationSql = readFileSync(migrationPath, "utf8");
    console.log(`   ↳ ${migrationFile}`);
    await sql.unsafe(migrationSql);
  }
  console.log("✅ Migrations applied successfully!");

  // Verify tables
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log(`\n📋 Tables created (${tables.length}):`);
  for (const t of tables) {
    console.log(`   • ${t.table_name}`);
  }

  console.log("\n🎉 Database is ready!");
} catch (err) {
  console.error("❌ Error applying schema:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
