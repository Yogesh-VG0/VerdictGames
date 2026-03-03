import postgres from "postgres";
import { readFileSync } from "fs";

// ═══════════════════════════════════════════════════════
// VERDICT.GAMES — Smart Trending & Featured Flags
//
// Uses RAWG "most added in last 90 days" API to find
// games that are ACTUALLY trending right now, then
// cross-references our DB. Falls back to a recency +
// popularity weighted score for remaining slots.
// ═══════════════════════════════════════════════════════

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
const RAWG_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE = "https://api.rawg.io/api";

function dateRange(daysBack, daysForward = 0) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - daysBack);
  const to = new Date(now);
  to.setDate(to.getDate() + daysForward);
  return `${from.toISOString().slice(0, 10)},${to.toISOString().slice(0, 10)}`;
}

async function fetchRawgList(ordering, dates, size = 20) {
  const params = new URLSearchParams({
    key: RAWG_KEY,
    ordering,
    page_size: String(size),
    ...(dates ? { dates } : {}),
  });
  try {
    const res = await fetch(`${RAWG_BASE}/games?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []).map((g) => ({
      name: g.name,
      slug: g.slug,
      added: g.added ?? 0,
      rating: g.rating ?? 0,
      released: g.released,
    }));
  } catch {
    return [];
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Step 1: Fetch multiple trending lists from RAWG ──
console.log("🔍 Fetching real-time trending data from RAWG...\n");

const [trendingRecent, trendingWider, hotNew, topYear] = await Promise.all([
  fetchRawgList("-added", dateRange(60), 25),
  fetchRawgList("-added", dateRange(180), 20),
  fetchRawgList("-released", dateRange(30), 15),
  fetchRawgList("-rating", `${new Date().getFullYear()}-01-01,${new Date().toISOString().slice(0, 10)}`, 15),
]);

// Deduplicate RAWG results, prioritizing the first list order
const seen = new Set();
const rawgGames = [];
for (const list of [trendingRecent, trendingWider, hotNew, topYear]) {
  for (const g of list) {
    if (!seen.has(g.slug)) {
      seen.add(g.slug);
      rawgGames.push(g);
    }
  }
}
console.log(`RAWG returned ${rawgGames.length} unique trending/recent games\n`);

// ── Step 2: Reset all flags ──
await sql`UPDATE games SET trending = false, featured = false`;

// ── Step 3: Match RAWG trending games to our database ──
const trendingIds = [];
const matched = [];
for (const rg of rawgGames) {
  if (trendingIds.length >= 20) break;

  // Try exact slug match
  const ourSlug = slugify(rg.name);
  const [match] =
    await sql`SELECT id, title, slug, score FROM games WHERE slug = ${rg.slug} OR slug = ${ourSlug} LIMIT 1`;
  if (match) {
    trendingIds.push(match.id);
    matched.push({ title: match.title, score: match.score, source: "RAWG trending" });
    continue;
  }
  // Try case-insensitive name match
  const [nameMatch] =
    await sql`SELECT id, title, slug, score FROM games WHERE LOWER(title) = LOWER(${rg.name}) LIMIT 1`;
  if (nameMatch) {
    trendingIds.push(nameMatch.id);
    matched.push({ title: nameMatch.title, score: nameMatch.score, source: "RAWG name" });
    continue;
  }
}

console.log(`Matched ${trendingIds.length} RAWG trending games in our database:`);
for (const m of matched) {
  console.log(`  ✓ [${m.score}] ${m.title} (${m.source})`);
}

// ── Step 4: Fill remaining slots with recency + popularity score ──
if (trendingIds.length < 20) {
  const needed = 20 - trendingIds.length;
  console.log(`\n📊 Filling ${needed} remaining slots with recency-weighted games...`);

  const exclude = trendingIds.length > 0 ? trendingIds : ["00000000-0000-0000-0000-000000000000"];
  const fillGames = await sql`
    SELECT id, title, score, release_date, current_players, review_count,
      (
        (score * 0.25) +
        (CASE
          WHEN release_date >= CURRENT_DATE - INTERVAL '6 months' THEN 40
          WHEN release_date >= CURRENT_DATE - INTERVAL '1 year' THEN 30
          WHEN release_date >= CURRENT_DATE - INTERVAL '2 years' THEN 20
          WHEN release_date >= CURRENT_DATE - INTERVAL '4 years' THEN 10
          ELSE 0
        END) +
        LEAST(COALESCE(current_players, 0) / 50.0, 20) +
        LEAST(COALESCE(review_count, 0) / 5000.0, 10)
      ) AS trending_score
    FROM games
    WHERE id != ALL(${exclude})
      AND release_date IS NOT NULL
    ORDER BY trending_score DESC
    LIMIT ${needed}
  `;

  for (const g of fillGames) {
    trendingIds.push(g.id);
    console.log(
      `  + [${g.score}] ${g.title} (released: ${g.release_date}, players: ${g.current_players ?? 0}, trending_score: ${Math.round(g.trending_score)})`
    );
  }
}

// ── Step 5: Apply trending flags ──
const uniqueIds = [...new Set(trendingIds)].slice(0, 20);
if (uniqueIds.length > 0) {
  await sql`UPDATE games SET trending = true WHERE id = ANY(${uniqueIds})`;
}
console.log(`\n🔥 Marked ${uniqueIds.length} games as trending`);

// ── Step 6: Featured = top 5 trending games by score ──
const featuredGames = await sql`
  SELECT id, title, score FROM games
  WHERE trending = true
  ORDER BY score DESC
  LIMIT 5
`;
const featuredIds = featuredGames.map((g) => g.id);
if (featuredIds.length > 0) {
  await sql`UPDATE games SET featured = true WHERE id = ANY(${featuredIds})`;
}
console.log(
  `⭐ Featured: ${featuredGames.map((g) => `${g.title} (${g.score})`).join(", ")}`
);

// ── Stats ──
const [{ count }] = await sql`SELECT COUNT(*) as count FROM games`;
const [{ trending_count }] =
  await sql`SELECT COUNT(*) as trending_count FROM games WHERE trending = true`;
console.log(`\n📈 Total games: ${count} | Trending: ${trending_count}`);

await sql.end();
console.log("✅ Done!");
