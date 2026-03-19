/**
 * Apply migration 011: Create avatars storage bucket
 *
 * Run: node scripts/apply-migration-011.mjs
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
    const migrationPath = resolve(__dirname, "../supabase/migrations/011_storage_avatars.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    console.log("🔄 Applying migration 011: Avatars Storage Bucket...");
    await sql.unsafe(migrationSql);
    console.log("✅ Migration 011 applied successfully!");

    const buckets = await sql`
      SELECT id, name, public, file_size_limit
      FROM storage.buckets
      WHERE id = 'avatars';
    `;
    if (buckets.length > 0) {
      console.log(`\n📋 Bucket created: ${buckets[0].name} (public: ${buckets[0].public}, max: ${buckets[0].file_size_limit} bytes)`);
    } else {
      console.log("\n⚠️ Bucket not found — you may need to create it via Supabase Dashboard → Storage.");
    }
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    console.log("\n💡 If RLS policies already exist, this is safe to ignore.");
    console.log("💡 You can also create the bucket manually via Supabase Dashboard → Storage → New Bucket → 'avatars' (public, 2MB limit).");
  } finally {
    await sql.end();
  }
}

run();
