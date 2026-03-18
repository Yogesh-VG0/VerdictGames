#!/usr/bin/env node

/**
 * Verify Supabase DB schema has required columns.
 * Run: node scripts/verify-db.mjs
 */

import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

const REQUIRED_COLUMNS = [
  "id", "slug", "title", "description", "score", "verdict_label",
  "current_players", "peak_players_24h", "steam_app_id", "rawg_id",
  "is_refreshing", "refresh_started_at", "last_enriched_at",
  "price_current", "is_free", "wikipedia_url", "wikipedia_excerpt",
];

async function main() {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'games' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  const names = cols.map((r) => r.column_name);
  const missing = REQUIRED_COLUMNS.filter((c) => !names.includes(c));
  if (missing.length) {
    console.error("Missing columns:", missing.join(", "));
    process.exit(1);
  }
  const count = await sql`SELECT count(*)::int as n FROM games`;
  console.log("✅ DB schema OK. games table has", count[0].n, "rows.");
}

main()
  .then(() => sql.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
