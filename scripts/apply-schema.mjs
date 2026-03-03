#!/usr/bin/env node
/**
 * Apply database schema to Supabase.
 *
 * Usage:
 *   node scripts/apply-schema.mjs
 *
 * Requires DATABASE_URL in .env or as env var.
 * Get it from: Supabase Dashboard → Settings → Database → Connection string (URI)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to load .env manually
try {
  const envPath = resolve(__dirname, "..", ".env");
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
  // .env not found, that's fine
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(`
╔══════════════════════════════════════════════════════╗
║  DATABASE_URL not found!                             ║
║                                                      ║
║  Add to your .env file:                              ║
║  DATABASE_URL=postgresql://postgres.[ref]:[pass]@... ║
║                                                      ║
║  Find it in Supabase Dashboard:                      ║
║    Settings → Database → Connection string (URI)     ║
║    Choose "Transaction" mode for Supavisor pooler    ║
╚══════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

console.log("🔌 Connecting to database...");
const sql = postgres(dbUrl, { max: 1 });

try {
  // Test connection
  const [{ now }] = await sql`SELECT now()`;
  console.log(`✅ Connected! Server time: ${now}`);

  // Read schema
  const schemaPath = resolve(__dirname, "..", "supabase", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");

  console.log("📦 Applying schema...");
  await sql.unsafe(schema);
  console.log("✅ Schema applied successfully!");

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
