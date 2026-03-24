#!/usr/bin/env node

/**
 * VERDICT.GAMES — Seed Curated Lists
 *
 * Generates 10 orthogonal editorial lists from existing game metadata.
 * Run manually or scheduled via Heroku Scheduler (daily at 2:00 AM UTC):
 *   node scripts/seed-curated-lists.mjs
 *
 * Overlap rules enforced:
 *  - No game appears in more than 2 lists globally
 *  - Any two lists must be at least 50% different (pairwise Jaccard check)
 *
 * Lists:
 *  1. Best Recent Single-Player RPGs
 *  2. Best Co-op Games Right Now
 *  3. Best Recent Horror Games
 *  4. Best Strategy & Builder Games
 *  5. Best Story-Driven Adventures
 *  6. Best Indie Games Under 20 Hours
 *  7. Best Competitive Multiplayer Games
 *  8. Most Wanted Upcoming <current year> Games
 *  9. Best Deckbuilders & Turn-Based Games
 * 10. Hidden Gems Since 2024
 */

import { startRun, finishRun } from './lib/scheduler-logger.mjs';
import { connectDb } from './lib/db-connect.mjs';

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

const sql = connectDb("seed-curated-lists");

function yearsAgoISO(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const SYSTEM_CURATOR = "editorial";

// Define list blueprints — each contains SQL criteria to pick games
// ── Overlap enforcement ──
// Rule 1: No game in more than 2 lists globally.
// Rule 2: Any two lists must be ≥ 50% different (Jaccard dissimilarity).
const gameAppearanceCount = new Map();
const seededListSets = {}; // slug → Set<id>
const usedCoverImages = new Set(); // Track cover images to avoid duplicates across lists

function enforceOverlapConstraints(ids, maxPerGame = 2) {
  const result = [];
  for (const id of ids) {
    const count = gameAppearanceCount.get(id) ?? 0;
    if (count < maxPerGame) result.push(id);
  }
  return result;
}

function recordAppearances(slug, ids) {
  seededListSets[slug] = new Set(ids);
  for (const id of ids) {
    gameAppearanceCount.set(id, (gameAppearanceCount.get(id) ?? 0) + 1);
  }
}

// Returns true if the proposed list is ≥ 50% different from ALL already-seeded lists.
// Jaccard similarity = |A ∩ B| / |A ∪ B|; we require similarity < 0.5.
function passesPairwiseOverlap(proposedIds) {
  const proposed = new Set(proposedIds);
  for (const [otherSlug, otherSet] of Object.entries(seededListSets)) {
    const intersection = [...proposed].filter((id) => otherSet.has(id)).length;
    const union = new Set([...proposed, ...otherSet]).size;
    const similarity = union > 0 ? intersection / union : 0;
    if (similarity >= 0.5) {
      return { ok: false, conflictSlug: otherSlug, similarity: (similarity * 100).toFixed(0) };
    }
  }
  return { ok: true };
}

const LIST_BLUEPRINTS = [
  {
    slug: "best-single-player-rpgs",
    title: "Best Recent Single-Player RPGs",
    description: "Deep, solo RPG experiences from the last 4 years — rich worlds, complex systems, unforgettable stories.",
    tags: ["editorial", "rpg", "single-player"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['RPG']
        AND NOT (genres && ARRAY['Massively Multiplayer'])
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 20
    `,
  },
  {
    slug: "best-co-op-games",
    title: "Best Co-op Games Right Now",
    description: "Games built for playing together — local or online co-op that reward teamwork.",
    tags: ["editorial", "co-op", "multiplayer"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (tags && ARRAY['Co-op', 'Online Co-Op', 'Local Co-Op', 'Co-op Campaign', 'Multiplayer', 'Local Multiplayer']
             OR genres && ARRAY['Massively Multiplayer'])
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 74
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC, current_players DESC NULLS LAST
      LIMIT 20
    `,
  },
  {
    slug: "best-horror-games",
    title: "Best Recent Horror Games",
    description: "Survival horror, psychological terror, and atmospheric dread — the best horror games since 2021.",
    tags: ["editorial", "horror", "genre"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Horror'] OR tags && ARRAY['Horror', 'Survival Horror', 'Psychological Horror', 'Atmospheric'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 72
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 20
    `,
  },
  {
    slug: "best-strategy-builder-games",
    title: "Best Strategy & Builder Games",
    description: "Grand strategy, 4X, city builders, and RTS games that demand your full attention.",
    tags: ["editorial", "strategy", "builder", "4x"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Strategy'] OR tags && ARRAY['City Builder', 'Base Building', '4X', 'Grand Strategy', 'RTS', 'Turn-Based Strategy'])
        AND NOT (genres && ARRAY['RPG'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 76
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 20
    `,
  },
  {
    slug: "best-story-driven-adventures",
    title: "Best Story-Driven Adventures",
    description: "Games where narrative is the star — cinematic storytelling, branching choices, emotional impact.",
    tags: ["editorial", "story", "narrative", "adventure"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (tags && ARRAY['Story Rich', 'Choices Matter', 'Narrative', 'Cinematic', 'Visual Novel', 'Interactive Fiction']
             OR genres && ARRAY['Adventure'])
        AND NOT (genres && ARRAY['RPG', 'Strategy', 'Shooter'])
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 20
    `,
  },
  {
    slug: "best-indie-under-20-hours",
    title: "Best Indie Games Under 20 Hours",
    description: "Tight, focused indie experiences you can finish in a weekend. No filler, all killer.",
    tags: ["editorial", "indie", "short", "accessible"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Indie'] OR tags && ARRAY['Indie'])
        AND (hltb_main IS NULL OR hltb_main <= 20)
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 80
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 20
    `,
  },
  {
    slug: "best-competitive-multiplayer",
    title: "Best Competitive Multiplayer Games",
    description: "Shooters, fighters, MOBAs, and sports games with active ranked scenes and deep skill ceilings.",
    tags: ["editorial", "competitive", "multiplayer", "pvp"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (tags && ARRAY['PvP', 'Competitive', 'eSports', 'Battle Royale', 'Arena Shooter', 'MOBA', 'Fighting', 'First-Person Shooter']
             OR genres && ARRAY['Shooter', 'Fighting', 'Sports'])
        AND NOT (genres && ARRAY['RPG', 'Adventure'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 72
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC, current_players DESC NULLS LAST
      LIMIT 20
    `,
  },
  {
    slug: `most-wanted-${new Date().getFullYear()}`,
    title: `Most Wanted Upcoming ${new Date().getFullYear()} Games`,
    description: `The most anticipated games releasing in ${new Date().getFullYear()}. Add them to your watchlist now.`,
    tags: ["editorial", "upcoming", String(new Date().getFullYear()), "wishlist"],
    query: async () => {
      const yearStr = String(new Date().getFullYear());
      return sql`
        SELECT id FROM games
        WHERE release_date >= ${yearStr + "-01-01"}
          AND release_date <= ${yearStr + "-12-31"}
          AND cover_image IS NOT NULL AND cover_image != ''
        ORDER BY score DESC NULLS LAST, release_date ASC
        LIMIT 20
      `;
    },
  },
  {
    slug: "best-deckbuilders-turn-based",
    title: "Best Deckbuilders & Turn-Based Games",
    description: "Roguelike deckbuilders, tactical turn-based RPGs, and deep card-game hybrids.",
    tags: ["editorial", "deckbuilder", "turn-based", "roguelike"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (tags && ARRAY['Deckbuilder', 'Card Game', 'Turn-Based', 'Turn-Based Combat', 'Roguelike', 'Roguelite', 'Turn-Based Tactics']
             OR genres && ARRAY['Card Game'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 76
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC
      LIMIT 20
    `,
  },
  {
    slug: "hidden-gems-since-2024",
    title: "Hidden Gems Since 2024",
    description: "Critically acclaimed games since 2024 that didn't get the spotlight they deserved. High scores, low hype.",
    tags: ["editorial", "hidden-gems", "underrated", "2024"],
    query: async () => sql`
      SELECT id FROM games
      WHERE score >= 82
        AND review_count < 1000
        AND release_date >= '2024-01-01'
        AND release_date <= CURRENT_DATE
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY score DESC, review_count ASC
      LIMIT 20
    `,
  },
];

// ── Main ──

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Seed Curated Lists");
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

const run = await startRun(sql, 'seed-curated-lists');

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

  // Apply overlap constraint: no game in more than 2 lists
  const allIds = gameRows.map((r) => r.id);
  const constrainedIds = enforceOverlapConstraints(allIds, 2).slice(0, 12);

  if (constrainedIds.length < 4) {
    console.log(`  ⚠ Only ${constrainedIds.length} games after overlap enforcement (min 4 required), skipping`);
    skipped++;
    continue;
  }

  // Pairwise 50% overlap check: this list must be ≥50% different from every other seeded list
  const pairwiseCheck = passesPairwiseOverlap(constrainedIds);
  if (!pairwiseCheck.ok) {
    console.log(`  ⚠ Pairwise overlap too high with "${pairwiseCheck.conflictSlug}" (${pairwiseCheck.similarity}% similar). Trying with tighter constraint...`);
    // Try again with a stricter per-game appearance limit (1 instead of 2)
    const stricterIds = enforceOverlapConstraints(allIds, 1).slice(0, 12);
    const recheckPairwise = passesPairwiseOverlap(stricterIds);
    if (!recheckPairwise.ok || stricterIds.length < 4) {
      console.log(`  ⚠ Still too similar after strict enforcement. Skipping "${blueprint.title}"`);
      skipped++;
      continue;
    }
    constrainedIds.length = 0;
    constrainedIds.push(...stricterIds);
  }

  console.log(`  ✓ ${gameRows.length} raw → ${constrainedIds.length} after overlap enforcement`);

  // Get a unique cover image for this list (avoid duplicates across lists)
  let coverImage = "";
  for (const gid of constrainedIds) {
    const [g] = await sql`SELECT cover_image, header_image FROM games WHERE id = ${gid} LIMIT 1`;
    const img = g?.header_image || g?.cover_image || "";
    if (img && !usedCoverImages.has(img)) {
      coverImage = img;
      usedCoverImages.add(img);
      break;
    }
  }
  // Fallback: use first game's image even if duplicate
  if (!coverImage) {
    const [g] = await sql`SELECT cover_image, header_image FROM games WHERE id = ${constrainedIds[0]} LIMIT 1`;
    coverImage = g?.header_image || g?.cover_image || "";
  }

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

  const items = constrainedIds.map((id, i) => ({
    list_id: listId,
    game_id: id,
    position: i + 1,
  }));

  for (const item of items) {
    await sql`
      INSERT INTO list_items (list_id, game_id, position, added_at)
      VALUES (${item.list_id}, ${item.game_id}, ${item.position}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }

  // Record these games as used (global + pairwise overlap tracking)
  recordAppearances(blueprint.slug, constrainedIds);

  console.log(`  ✓ Inserted ${items.length} games into list`);
}

console.log("\n═══════════════════════════════════════════");
console.log(`  Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);
console.log("  ✅ Done!");
console.log("═══════════════════════════════════════════\n");

await finishRun(sql, run.id, {
  rows_created: created,
  rows_updated: updated,
  rows_skipped: skipped,
  rows_scanned: LIST_BLUEPRINTS.length,
});
await sql.end();
