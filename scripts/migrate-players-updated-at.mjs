#!/usr/bin/env node

/**
 * VERDICT.GAMES — Migration: Add players_updated_at column
 *
 * Adds a timestamptz column to track when current_players was last refreshed.
 *
 * Run: node scripts/migrate-players-updated-at.mjs
 */

import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

console.log("Adding players_updated_at column...");

await sql`
  ALTER TABLE games
  ADD COLUMN IF NOT EXISTS players_updated_at timestamptz
`;

// Backfill: set to now() for games that already have current_players
const updated = await sql`
  UPDATE games SET players_updated_at = NOW()
  WHERE current_players IS NOT NULL AND players_updated_at IS NULL
`;

console.log(`✅ Column added. Backfilled ${updated.count} rows.`);
await sql.end();
