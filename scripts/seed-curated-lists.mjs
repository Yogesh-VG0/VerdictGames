#!/usr/bin/env node

/**
 * VERDICT.GAMES — Seed Curated Lists
 *
 * Generates system/editorial curated lists from existing game metadata.
 * Run manually or as part of the ingest pipeline:
 *   node scripts/seed-curated-lists.mjs
 *
 * Lists created:
 *  1. Must-Play Games of 2024–2025
 *  2. Best RPGs Right Now
 *  3. Top Indie Picks
 *  4. Best Shooters
 *  5. Best Strategy Games
 *  6. Top Action-Adventure Games
 *  7. Upcoming This Year
 *  8. Best Free-to-Play Games
 *  9. Hidden Gems (score ≥ 85, reviewCount < 100)
 * 10. Best of the Last 2 Years
 */

import postgres from "postgres";

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
} catch { /* Heroku uses Config Vars */ }

const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function yearsAgoISO(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const SYSTEM_CURATOR = "editorial";

// Define list blueprints — each contains SQL criteria to pick games
const LIST_BLUEPRINTS = [
  {
    slug: "must-play-2024-2025",
    title: "Must-Play Games of 2024–2025",
    description: "The highest-rated games released in 2024 and 2025 — the cream of the crop.",
    tags: ["editorial", "2024", "2025", "top-rated"],
    query: async () => sql`
      SELECT id FROM games
      WHERE release_date >= '2024-01-01'
        AND release_date <= CURRENT_DATE
        AND score >= 88
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC, review_count DESC
      LIMIT 12
    `,
  },
  {
    slug: "best-rpgs-right-now",
    title: "Best RPGs Right Now",
    description: "Top-rated RPGs from the last 3 years. Epic worlds, deep stories, unforgettable characters.",
    tags: ["editorial", "rpg", "genre"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['RPG']
        AND release_date >= ${yearsAgoISO(3)}
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 12
    `,
  },
  {
    slug: "top-indie-picks",
    title: "Top Indie Picks",
    description: "The best indie games proving that small studios make some of the most memorable experiences.",
    tags: ["editorial", "indie", "genre"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Indie'] OR tags && ARRAY['Indie'])
        AND release_date >= ${yearsAgoISO(3)}
        AND release_date <= CURRENT_DATE
        AND score >= 80
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 12
    `,
  },
  {
    slug: "best-shooters",
    title: "Best Shooters",
    description: "First-person and third-person shooters worth your time — from tactical to fast-paced.",
    tags: ["editorial", "shooter", "genre"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['Shooter']
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 75
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 12
    `,
  },
  {
    slug: "best-strategy-games",
    title: "Best Strategy Games",
    description: "Turn-based and real-time strategy games that will keep your brain busy for hours.",
    tags: ["editorial", "strategy", "genre"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['Strategy']
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 12
    `,
  },
  {
    slug: "best-action-adventure",
    title: "Top Action-Adventure Games",
    description: "The best action-adventure experiences — exploration, combat, and compelling worlds.",
    tags: ["editorial", "action", "adventure", "genre"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['Action', 'Adventure']
        AND release_date >= ${yearsAgoISO(3)}
        AND release_date <= CURRENT_DATE
        AND score >= 80
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 12
    `,
  },
  {
    slug: "upcoming-this-year",
    title: "Upcoming This Year",
    description: "Highly anticipated games releasing soon — add them to your wishlist now.",
    tags: ["editorial", "upcoming", "2025", "2026"],
    query: async () => sql`
      SELECT id FROM games
      WHERE release_date > CURRENT_DATE
        AND release_date <= (CURRENT_DATE + INTERVAL '12 months')
        AND cover_image IS NOT NULL AND cover_image != ''
      ORDER BY release_date ASC, score DESC
      LIMIT 12
    `,
  },
  {
    slug: "best-free-to-play",
    title: "Best Free-to-Play Games",
    description: "Zero cost, maximum fun. The best free-to-play games worth your time.",
    tags: ["editorial", "free-to-play", "f2p"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (is_free = true OR monetization ILIKE '%Free%')
        AND score >= 70
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC, current_players DESC NULLS LAST
      LIMIT 12
    `,
  },
  {
    slug: "hidden-gems",
    title: "Hidden Gems",
    description: "Critically acclaimed games that flew under the radar. High scores, low noise.",
    tags: ["editorial", "hidden-gems", "underrated"],
    query: async () => sql`
      SELECT id FROM games
      WHERE score >= 85
        AND review_count < 500
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC, review_count ASC
      LIMIT 12
    `,
  },
  {
    slug: "best-of-last-2-years",
    title: "Best of the Last 2 Years",
    description: "The highest-scoring games released in the past 24 months. Your definitive shortlist.",
    tags: ["editorial", "recent", "top-rated"],
    query: async () => sql`
      SELECT id FROM games
      WHERE release_date >= ${yearsAgoISO(2)}
        AND release_date <= CURRENT_DATE
        AND score >= 82
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 12
    `,
  },
];

// ── Main ──

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Seed Curated Lists");
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

let created = 0;
let updated = 0;
let skipped = 0;

for (const blueprint of LIST_BLUEPRINTS) {
  console.log(`\n📋 Processing: "${blueprint.title}"`);

  // Run query to get game IDs
  const gameRows = await blueprint.query().catch((e) => {
    console.log(`  ✗ Query failed: ${e.message}`);
    return [];
  });

  if (gameRows.length === 0) {
    console.log("  ⚠ No games found, skipping");
    skipped++;
    continue;
  }

  console.log(`  ✓ Found ${gameRows.length} games`);

  // Get cover image from first game for the list cover
  const firstGame = await sql`
    SELECT cover_image, header_image FROM games WHERE id = ${gameRows[0].id} LIMIT 1
  `;
  const coverImage = firstGame[0]?.header_image || firstGame[0]?.cover_image || "";

  // Upsert the list
  const [existingList] = await sql`
    SELECT id FROM lists WHERE slug = ${blueprint.slug} LIMIT 1
  `;

  let listId;
  if (existingList) {
    await sql`
      UPDATE lists SET
        title = ${blueprint.title},
        description = ${blueprint.description},
        cover_image = ${coverImage},
        tags = ${blueprint.tags},
        updated_at = NOW()
      WHERE id = ${existingList.id}
    `;
    listId = existingList.id;
    console.log(`  ↺ Updated existing list (${listId})`);
    updated++;
  } else {
    const [newList] = await sql`
      INSERT INTO lists (slug, title, description, cover_image, curated_by, tags, is_public, created_at, updated_at)
      VALUES (
        ${blueprint.slug},
        ${blueprint.title},
        ${blueprint.description},
        ${coverImage},
        ${SYSTEM_CURATOR},
        ${blueprint.tags},
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    listId = newList.id;
    console.log(`  + Created new list (${listId})`);
    created++;
  }

  // Delete existing items for this list and re-insert fresh
  await sql`DELETE FROM list_items WHERE list_id = ${listId}`;

  const items = gameRows.map((row, i) => ({
    list_id: listId,
    game_id: row.id,
    position: i + 1,
  }));

  for (const item of items) {
    await sql`
      INSERT INTO list_items (list_id, game_id, position, added_at)
      VALUES (${item.list_id}, ${item.game_id}, ${item.position}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`  ✓ Inserted ${items.length} games into list`);
}

console.log("\n═══════════════════════════════════════════");
console.log(`  Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);
console.log("  ✅ Done!");
console.log("═══════════════════════════════════════════\n");

await sql.end();
