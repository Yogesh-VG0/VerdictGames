#!/usr/bin/env node

/**
 * VERDICT.GAMES — Migrations 006 + 007: Re-enrichment Safety Lock
 *
 * 006: Adds is_refreshing column
 * 007: Adds refresh_started_at for lock TTL (cleaner than updated_at)
 *
 * Run: node scripts/migrate-refresh-lock.mjs
 */

import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

console.log("Adding is_refreshing column (006)...");
await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS is_refreshing BOOLEAN DEFAULT false`;

console.log("Adding refresh_started_at column (007)...");
await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS refresh_started_at TIMESTAMPTZ`;

console.log("✅ Migrations 006 + 007 complete.");
await sql.end();
