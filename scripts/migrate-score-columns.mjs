#!/usr/bin/env node

/**
 * Migration: Add per-source score columns + backfill score_source
 */

import postgres from "postgres";

// Load .env for local
try {
  const { readFileSync } = await import("fs");
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = t.slice(i + 1).trim();
  }
} catch {}

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

try {
  // 1. Add new columns
  await sql.unsafe(`
    ALTER TABLE games
    ADD COLUMN IF NOT EXISTS steam_rating_label text,
    ADD COLUMN IF NOT EXISTS rawg_metacritic integer,
    ADD COLUMN IF NOT EXISTS rawg_rating real,
    ADD COLUMN IF NOT EXISTS score_source text NOT NULL DEFAULT 'blended'
  `);
  console.log("✓ Columns added");

  // 2. Backfill score_source from existing data
  const r1 = await sql.unsafe(
    `UPDATE games SET score_source = 'steam' WHERE user_score IS NOT NULL AND steam_app_id IS NOT NULL`
  );
  console.log(`  steam: ${r1.count} rows`);

  const r2 = await sql.unsafe(
    `UPDATE games SET score_source = 'igdb' WHERE score_source = 'blended' AND igdb_rating IS NOT NULL`
  );
  console.log(`  igdb: ${r2.count} rows`);

  // 3. Distribution
  const counts = await sql.unsafe(
    `SELECT score_source, count(*)::int as cnt FROM games GROUP BY score_source ORDER BY cnt DESC`
  );
  console.log("✓ Score source distribution:");
  for (const row of counts) {
    console.log(`  ${row.score_source}: ${row.cnt}`);
  }

  await sql.end();
  console.log("\nDone!");
} catch (e) {
  console.error("Migration failed:", e.message);
  await sql.end();
  process.exit(1);
}
