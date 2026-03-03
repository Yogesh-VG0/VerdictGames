import postgres from "postgres";
import { readFileSync } from "fs";

// Load .env
const env = readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const sql = postgres(process.env.DATABASE_URL);

// Reset all flags first
await sql`UPDATE games SET trending = false, featured = false`;

// Mark top 20 games as trending
const topGames = await sql`SELECT id, title, score FROM games ORDER BY score DESC LIMIT 20`;
console.log("Top 20 games (will be marked trending):");
for (const g of topGames) {
  console.log(" ", g.score, g.title);
}

const ids = topGames.map((g) => g.id);
await sql`UPDATE games SET trending = true WHERE id = ANY(${ids})`;
console.log("Marked", ids.length, "games as trending");

// Mark top 5 as featured (hero banner rotation)
const featuredIds = ids.slice(0, 5);
await sql`UPDATE games SET featured = true WHERE id = ANY(${featuredIds})`;
console.log("Marked featured:", topGames.slice(0, 5).map(g => g.title).join(", "));

// Total game count
const [{count}] = await sql`SELECT COUNT(*) as count FROM games`;
console.log(`\nTotal games in database: ${count}`);

// Verify steam_url for games that have steam_app_id
const steamGames = await sql`SELECT title, steam_app_id, steam_url FROM games WHERE steam_app_id IS NOT NULL LIMIT 5`;
console.log("\nSteam data check:");
for (const g of steamGames) {
  console.log(" ", g.title, "| app_id:", g.steam_app_id, "| url:", g.steam_url || "(none)");
}

await sql.end();
console.log("\nDone!");
