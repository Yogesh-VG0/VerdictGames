#!/usr/bin/env node

/**
 * VERDICT.GAMES — Seed Curated Lists
 *
 * Generates 22 orthogonal editorial lists from existing game metadata.
 * Run manually or scheduled via GitHub Actions (daily at 02:23 UTC):
 *   node scripts/seed-curated-lists.mjs
 *
 * Overlap rules enforced:
 *  - No game appears in more than 3 lists globally
 *  - Any two lists must be at least 50% different (pairwise Jaccard check)
 *
 * Scoring: All queries use confidence-weighted score ordering
 *   CWS = (score * review_count + 75 * 200) / (review_count + 200)
 *   This prevents low-review games with inflated raw scores from dominating.
 *
 * Lists (22 total):
 *  1. Best Recent Single-Player RPGs      12. Best Platformers
 *  2. Best Co-op Games Right Now           13. Best Roguelikes & Roguelites
 *  3. Best Recent Horror Games             14. Critically Acclaimed in 2024
 *  4. Best Strategy & Builder Games        15. Best Multiplayer Experiences
 *  5. Best Story-Driven Adventures         16. Survival Horror Essentials
 *  6. Best Indie Games Under 20 Hours      17. Best Strategy Games
 *  7. Best Competitive Multiplayer Games   18. Top Open World Adventures
 *  8. Most Wanted Upcoming <year> Games    19. Essential Metroidvanias
 *  9. Best Deckbuilders & Turn-Based       20. Hidden Indie Gems
 * 10. Hidden Gems Since 2024               21. Cozy Games to Unwind With
 * 11. Sci-Fi Epics                         22. Best Action RPGs of All Time
 */

import { startRun, finishRun, acquireLock, releaseLock } from './lib/scheduler-logger.mjs';
import { connectDb, closeDb } from './lib/db-connect.mjs';
import { createHash } from 'node:crypto';

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
} catch { /* Use process environment variables. */ }

const sql = connectDb("seed-curated-lists");
const SYSTEM_LIST_MANAGER = "system-curated-lists";
const SYSTEM_LIST_SEED_VERSION = 3;

function yearsAgoISO(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const SYSTEM_CURATOR = "editorial";

function buildSeedHash(seed, gameIds) {
  return createHash("sha256")
    .update(JSON.stringify({
      slug: seed.slug,
      title: seed.title,
      previewText: seed.previewText,
      bodyText: seed.bodyText,
      tags: seed.tags,
      gameIds,
      seedVersion: SYSTEM_LIST_SEED_VERSION,
    }))
    .digest("hex");
}

// Define list blueprints — each contains SQL criteria to pick games
// ── Overlap enforcement ──
// Rule 1: No game in more than 2 lists globally.
// Rule 2: Any two lists must be ≥ 50% different (Jaccard dissimilarity).
const gameAppearanceCount = new Map();
const seededListSets = {}; // slug → Set<id>
const usedCoverImages = new Set(); // Track cover images to avoid duplicates across lists

// Minimum review counts — prevents low-review games with inflated scores
const MIN_LIST_REVIEWS = 20;      // for recent/thematic lists
const MIN_ALLTIME_REVIEWS = 50;   // for all-time lists (higher bar for classics)

// Confidence-weighted score SQL (inlined in ORDER BY):
// (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC

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
  // ── 1. Best Recent Single-Player RPGs ──
  // FIX: Require explicit single-player tags, exclude multiplayer-focused games
  {
    slug: "best-single-player-rpgs",
    title: "Best Recent Single-Player RPGs",
    description: "Deep, solo RPG experiences from the last 4 years — rich worlds, complex systems, unforgettable stories.",
    tags: ["editorial", "rpg", "single-player"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['RPG']
        AND (tags && ARRAY['Singleplayer', 'Story Rich', 'Choices Matter', 'CRPG', 'JRPG', 'Action RPG']
             OR (tags && ARRAY['Open World'] AND NOT (tags && ARRAY['Multiplayer', 'Online Co-Op', 'Co-op Campaign', 'PvP', 'MMO', 'MMORPG'])))
        AND NOT (genres && ARRAY['Massively Multiplayer'])
        AND NOT (tags && ARRAY['Multiplayer', 'Online Co-Op', 'Co-op Campaign', 'PvP', 'MMO', 'MMORPG', 'Battle Royale'])
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 2. Best Co-op Games Right Now ──
  {
    slug: "best-co-op-games",
    title: "Best Co-op Games Right Now",
    description: "Games built for playing together — local or online co-op that reward teamwork.",
    tags: ["editorial", "co-op", "multiplayer"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Co-op', 'Online Co-Op', 'Local Co-Op', 'Co-op Campaign']
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 74
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC,
             current_players DESC NULLS LAST
      LIMIT 24
    `,
  },
  // ── 3. Best Recent Horror Games ──
  // NOTE: 'Atmospheric' tag REMOVED — too broad, pulled non-horror games
  {
    slug: "best-horror-games",
    title: "Best Recent Horror Games",
    description: "Survival horror, psychological terror, and atmospheric dread — the best horror games since 2021.",
    tags: ["editorial", "horror", "genre"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Horror']
             OR tags && ARRAY['Horror', 'Survival Horror', 'Psychological Horror', 'Lovecraftian'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 72
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 4. Best Strategy & Builder Games ──
  {
    slug: "best-strategy-builder-games",
    title: "Best Strategy & Builder Games",
    description: "Grand strategy, 4X, city builders, and RTS games that demand your full attention.",
    tags: ["editorial", "strategy", "builder", "4x"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Strategy']
             OR tags && ARRAY['City Builder', 'Base Building', '4X', 'Grand Strategy', 'RTS', 'Turn-Based Strategy', 'Real Time Tactics'])
        AND NOT (genres && ARRAY['RPG'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 76
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 5. Best Story-Driven Adventures ──
  // FIX: Require explicit narrative tags, not just Adventure genre
  {
    slug: "best-story-driven-adventures",
    title: "Best Story-Driven Adventures",
    description: "Games where narrative is the star — cinematic storytelling, branching choices, emotional impact.",
    tags: ["editorial", "story", "narrative", "adventure"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Story Rich', 'Choices Matter', 'Narrative', 'Cinematic', 'Visual Novel', 'Interactive Fiction', 'Emotional', 'Multiple Endings']
        AND NOT (genres && ARRAY['Strategy', 'Sports', 'Racing'])
        AND NOT (tags && ARRAY['Competitive', 'PvP', 'Battle Royale', 'Multiplayer'])
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 6. Best Indie Games Under 20 Hours ──
  {
    slug: "best-indie-under-20-hours",
    title: "Best Indie Games Under 20 Hours",
    description: "Tight, focused indie experiences you can finish in a weekend. No filler, all killer.",
    tags: ["editorial", "indie", "short", "accessible"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Indie'] OR tags && ARRAY['Indie'])
        AND hltb_main IS NOT NULL
        AND hltb_main <= 20
        AND release_date >= ${yearsAgoISO(4)}
        AND release_date <= CURRENT_DATE
        AND score >= 80
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 7. Best Competitive Multiplayer Games ──
  // FIX: Require explicit competitive tags, exclude casual/simulation
  {
    slug: "best-competitive-multiplayer",
    title: "Best Competitive Multiplayer Games",
    description: "Shooters, fighters, MOBAs, and sports games with active ranked scenes and deep skill ceilings.",
    tags: ["editorial", "competitive", "multiplayer", "pvp"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (tags && ARRAY['PvP', 'Competitive', 'eSports', 'Battle Royale', 'Arena Shooter', 'MOBA', 'Team-Based', 'Multiplayer']
             AND (genres && ARRAY['Shooter', 'Fighting', 'Sports'] OR tags && ARRAY['Fighting', 'FPS', 'Third-Person Shooter']))
        AND NOT (genres && ARRAY['RPG', 'Adventure', 'Simulation', 'Puzzle'])
        AND NOT (tags && ARRAY['Relaxing', 'Casual', 'Singleplayer', 'Story Rich'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 72
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY current_players DESC NULLS LAST,
             (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 8. Most Wanted Upcoming Games ──
  // FIX: Must actually be UPCOMING (release_date > today), not just within the year
  {
    slug: `most-wanted-${new Date().getFullYear()}`,
    title: `Most Wanted Upcoming ${new Date().getFullYear()} Games`,
    description: `The most anticipated games releasing in ${new Date().getFullYear()}. Add them to your watchlist now.`,
    tags: ["editorial", "upcoming", String(new Date().getFullYear()), "wishlist"],
    query: async () => {
      const yearStr = String(new Date().getFullYear());
      const today = new Date().toISOString().slice(0, 10);
      return sql`
        SELECT id FROM games
        WHERE (
            (release_date > ${today} AND release_date <= ${yearStr + "-12-31"})
            OR (
              release_date IS NULL
              AND (
                is_provisional = true
                OR verdict_label = 'COMING SOON'
                OR COALESCE(release_status, '') IN ('announced', 'coming_soon', 'upcoming', 'tba')
              )
            )
          )
          AND cover_image IS NOT NULL AND cover_image != ''
        ORDER BY CASE WHEN release_date IS NULL THEN 1 ELSE 0 END,
               release_date ASC NULLS LAST,
               (score::float * GREATEST(COALESCE(review_count, 0), 0) + 75.0 * 200.0) / (GREATEST(COALESCE(review_count, 0), 0) + 200.0) DESC NULLS LAST
        LIMIT 24
      `;
    },
  },
  // ── 9. Best Deckbuilders & Turn-Based Games ──
  // NOTE: 'Roguelike'/'Roguelite' tags REMOVED — too broad, pulled action games like Sifu
  {
    slug: "best-deckbuilders-turn-based",
    title: "Best Deckbuilders & Turn-Based Games",
    description: "Roguelike deckbuilders, tactical turn-based RPGs, and deep card-game hybrids.",
    tags: ["editorial", "deckbuilder", "turn-based"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (tags && ARRAY['Deckbuilder', 'Card Game', 'Turn-Based', 'Turn-Based Combat', 'Turn-Based Tactics', 'Roguelike Deckbuilder']
             OR genres && ARRAY['Card Game'])
        AND release_date >= ${yearsAgoISO(5)}
        AND release_date <= CURRENT_DATE
        AND score >= 76
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 10. Hidden Gems Since 2024 ──
  {
    slug: "hidden-gems-since-2024",
    title: "Hidden Gems Since 2024",
    description: "Critically acclaimed games since 2024 that didn't get the spotlight they deserved. High scores, low hype.",
    tags: ["editorial", "hidden-gems", "underrated", "2024"],
    query: async () => sql`
      SELECT id FROM games
      WHERE score >= 82
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND review_count < 1000
        AND release_date >= '2024-01-01'
        AND release_date <= CURRENT_DATE
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC,
             review_count ASC
      LIMIT 24
    `,
  },

  // ═══════════════════════════════════════════════════════
  // All-time & thematic lists (lists 11–22)
  // ═══════════════════════════════════════════════════════

  // ── 11. Sci-Fi Epics ──
  {
    slug: "sci-fi-epics",
    title: "Sci-Fi Epics",
    description: "Sprawling science fiction adventures across space, time, and cyberpunk cityscapes.",
    tags: ["editorial", "sci-fi", "space", "cyberpunk"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Sci-fi', 'Space', 'Cyberpunk', 'Futuristic']
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 12. Best Platformers ──
  // FIX: Require explicit platformer genre/tags, exclude non-platforming games
  {
    slug: "best-platformers",
    title: "Best Platformers",
    description: "Precision jumps, creative level design, and tight controls — 2D and 3D platforming at its finest.",
    tags: ["editorial", "platformer", "2d", "3d"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Platformer']
             OR tags && ARRAY['Platformer', '2D Platformer', '3D Platformer', 'Precision Platformer', 'Collectathon'])
        AND NOT (genres && ARRAY['Sports', 'Racing', 'Strategy', 'Simulation'])
        AND NOT (tags && ARRAY['Multiplayer', 'PvP', 'MMO', 'MMORPG'])
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 13. Best Roguelikes & Roguelites ──
  {
    slug: "best-roguelikes-roguelites",
    title: "Best Roguelikes & Roguelites",
    description: "Procedural runs, permadeath tension, and the 'just one more run' loop perfected.",
    tags: ["editorial", "roguelike", "roguelite", "procedural"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Roguelike', 'Roguelite', 'Roguevania', 'Roguelike Deckbuilder']
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 14. Critically Acclaimed in 2024 ──
  {
    slug: "critically-acclaimed-2024",
    title: "Critically Acclaimed in 2024",
    description: "The highest-rated games released in 2024, backed by strong review consensus.",
    tags: ["editorial", "2024", "critically-acclaimed", "best-of"],
    query: async () => sql`
      SELECT id FROM games
      WHERE release_date >= '2024-01-01'
        AND release_date <= '2024-12-31'
        AND score >= 80
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 15. Best Multiplayer Experiences ──
  {
    slug: "best-multiplayer-experiences",
    title: "Best Multiplayer Experiences",
    description: "The best games to play with friends or strangers — from co-op adventures to party games.",
    tags: ["editorial", "multiplayer", "social", "party"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (tags && ARRAY['Multiplayer', 'Online Co-Op', 'Local Multiplayer', 'Local Co-Op', 'Party Game']
             OR genres && ARRAY['Massively Multiplayer'])
        AND release_date <= CURRENT_DATE
        AND score >= 76
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC,
             current_players DESC NULLS LAST
      LIMIT 24
    `,
  },
  // ── 16. Survival Horror Essentials ──
  // FIX: Require explicit survival horror tags, not just generic Horror genre
  {
    slug: "survival-horror-essentials",
    title: "Survival Horror Essentials",
    description: "Resource management meets terror — the best survival horror games of all time.",
    tags: ["editorial", "survival-horror", "horror", "classic"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Survival Horror', 'Psychological Horror', 'Horror']
        AND (tags && ARRAY['Survival', 'Resource Management', 'Atmospheric', 'Dark'] 
             OR genres && ARRAY['Horror'])
        AND NOT (genres && ARRAY['Strategy', 'Sports', 'Racing', 'Puzzle'])
        AND NOT (tags && ARRAY['Comedy', 'Funny', 'Cute', 'Relaxing'])
        AND release_date <= CURRENT_DATE
        AND score >= 76
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 17. Best Strategy Games (all-time) ──
  {
    slug: "best-strategy-games",
    title: "Best Strategy Games",
    description: "All-time greats in tactics, grand strategy, 4X, and real-time strategy.",
    tags: ["editorial", "strategy", "tactics", "all-time"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['Strategy']
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 18. Top Open World Adventures ──
  {
    slug: "top-open-world-adventures",
    title: "Top Open World Adventures",
    description: "Vast, explorable worlds packed with discovery, quests, and emergent storytelling.",
    tags: ["editorial", "open-world", "exploration", "adventure"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Open World']
        AND (genres && ARRAY['Adventure', 'Action', 'RPG']
             OR tags && ARRAY['Exploration', 'Story Rich', 'Action RPG', 'Action-Adventure'])
        AND NOT (genres && ARRAY['Sports', 'Racing', 'Simulation', 'Strategy'])
        AND NOT (tags && ARRAY['City Builder', 'Base Building', 'Colony Sim', 'Management', 'Competitive', 'PvP', 'MMO', 'MMORPG'])
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 19. Essential Metroidvanias ──
  {
    slug: "essential-metroidvanias",
    title: "Essential Metroidvanias",
    description: "Interconnected maps, ability-gated exploration, and satisfying progression loops.",
    tags: ["editorial", "metroidvania", "exploration", "2d"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Metroidvania']
        AND release_date <= CURRENT_DATE
        AND score >= 78
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 20. Hidden Indie Gems ──
  {
    slug: "hidden-indie-gems",
    title: "Hidden Indie Gems",
    description: "Under-the-radar indie games with outstanding quality — small studios, big impact.",
    tags: ["editorial", "indie", "hidden-gems", "underrated"],
    query: async () => sql`
      SELECT id FROM games
      WHERE (genres && ARRAY['Indie'] OR tags && ARRAY['Indie'])
        AND score >= 84
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND review_count < 500
        AND release_date <= CURRENT_DATE
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 21. Cozy Games to Unwind With ──
  {
    slug: "cozy-games-to-unwind",
    title: "Cozy Games to Unwind With",
    description: "Gentle, relaxing experiences perfect for unwinding — farming, crafting, and wholesome adventures.",
    tags: ["editorial", "cozy", "relaxing", "casual"],
    query: async () => sql`
      SELECT id FROM games
      WHERE tags && ARRAY['Relaxing', 'Casual', 'Wholesome', 'Cozy', 'Farming Sim', 'Life Sim']
        AND release_date <= CURRENT_DATE
        AND score >= 76
        AND review_count >= ${MIN_LIST_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
  // ── 22. Best Action RPGs of All Time ──
  {
    slug: "best-action-rpgs",
    title: "Best Action RPGs of All Time",
    description: "Real-time combat meets deep progression — the finest action RPGs ever made.",
    tags: ["editorial", "action-rpg", "rpg", "action"],
    query: async () => sql`
      SELECT id FROM games
      WHERE genres && ARRAY['RPG']
        AND (tags && ARRAY['Action RPG', 'Souls-like', 'Hack and Slash']
             OR (genres && ARRAY['Action'] AND tags && ARRAY['Action RPG']))
        AND (NOT (tags && ARRAY['Action-Adventure']) OR tags && ARRAY['Action RPG'])
        AND release_date <= CURRENT_DATE
        AND score >= 80
        AND review_count >= ${MIN_ALLTIME_REVIEWS}
        AND cover_image IS NOT NULL AND cover_image != ''
        AND score > 0 AND verdict_label != 'COMING SOON'
      ORDER BY (score::float * GREATEST(review_count, 0) + 75.0 * 200.0) / (GREATEST(review_count, 0) + 200.0) DESC
      LIMIT 24
    `,
  },
];

const CANONICAL_COUNTER_STRIKE_APPS = new Set([10, 80, 240, 730, 4465480]);
const LEGACY_CANONICAL_APPS = new Set([4465480]);

function normalizeCanonicalText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCanonicalKey(row) {
  if (row.steam_app_id != null && CANONICAL_COUNTER_STRIKE_APPS.has(row.steam_app_id)) {
    return "special:counter-strike";
  }

  if (row.steam_app_id != null) {
    return `steam:${row.steam_app_id}`;
  }

  return `title:${normalizeCanonicalText(row.title)}`;
}

function pickPreferredCanonicalRow(a, b) {
  const score = (row) => {
    let value = 0;

    if (!LEGACY_CANONICAL_APPS.has(row.steam_app_id)) {
      value += 1000;
    }

    if (row.steam_app_id === 730) {
      value += 4000;
    }

    if (row.steam_app_id === 4465480) {
      value -= 1000;
    }

    value += Math.min((row.current_players ?? 0) / 1000, 500);
    value += (row.verdict_score ?? row.score ?? 0) * 2;
    value += Math.min((row.review_count ?? 0) / 1000, 200);
    value += (row.confidence ?? 0) * 150;

    if (row.release_date) {
      const ageDays = Math.max(0, (Date.now() - new Date(row.release_date).getTime()) / 86400000);
      value += Math.max(0, 60 - Math.min(ageDays / 30, 60));
    }

    return value;
  };

  return score(b) > score(a) ? b : a;
}

async function dedupeCanonicalIds(ids) {
  if (ids.length === 0) {
    return [];
  }

  const rows = await sql`
    SELECT id, title, steam_app_id, current_players, verdict_score, score, review_count, confidence, release_date
    FROM games
    WHERE id = ANY(${ids})
  `;
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const byGroup = new Map();

  for (const id of ids) {
    const row = rowsById.get(id);
    if (!row) continue;
    const key = getCanonicalKey(row);
    const existing = byGroup.get(key);
    byGroup.set(key, existing ? pickPreferredCanonicalRow(existing, row) : row);
  }

  return Array.from(byGroup.values()).map((row) => row.id);
}

// ── Main ──

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Seed Curated Lists");
console.log(`  ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════\n");

const locked = await acquireLock(sql, 'seed-curated-lists');
if (!locked) { await closeDb(sql, 'seed-curated-lists'); process.exit(0); }

const run = await startRun(sql, 'seed-curated-lists');
const startedAt = Date.now();

let created = 0;
let updated = 0;
let skipped = 0;

try {
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

  // Apply overlap constraint: no game in more than 3 lists (relaxed for 22 lists)
  let allIds = gameRows.map((r) => r.id);
  allIds = await dedupeCanonicalIds(allIds);
  const constrainedIds = enforceOverlapConstraints(allIds, 3).slice(0, 12);

  if (constrainedIds.length < 4) {
    console.log(`  ⚠ Only ${constrainedIds.length} games after overlap enforcement (min 4 required), skipping`);
    skipped++;
    continue;
  }

  // Pairwise 50% overlap check: this list must be ≥50% different from every other seeded list
  const pairwiseCheck = passesPairwiseOverlap(constrainedIds);
  if (!pairwiseCheck.ok) {
    console.log(`  ⚠ Pairwise overlap too high with "${pairwiseCheck.conflictSlug}" (${pairwiseCheck.similarity}% similar). Trying with tighter constraint...`);
    // Try again with a stricter per-game appearance limit (2 instead of 3)
    const stricterIds = enforceOverlapConstraints(allIds, 2).slice(0, 12);
    const recheckPairwise = passesPairwiseOverlap(stricterIds);
    if (!recheckPairwise.ok || stricterIds.length < 4) {
      console.log(`  ⚠ Still too similar after strict enforcement. Skipping "${blueprint.title}"`);
      skipped++;
      continue;
    }
    constrainedIds.length = 0;
    constrainedIds.push(...stricterIds);
  }

  console.log(`  ✓ ${gameRows.length} raw → ${allIds.length} canonical → ${constrainedIds.length} after overlap enforcement`);

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

  const previewText = blueprint.description;
  const bodyText = blueprint.description;
  const seedHash = buildSeedHash({
    slug: blueprint.slug,
    title: blueprint.title,
    previewText,
    bodyText,
    tags: blueprint.tags,
  }, constrainedIds);

  // Upsert the list
  const [existingList] = await sql`
    SELECT id, title, is_system_managed FROM lists WHERE slug = ${blueprint.slug} LIMIT 1
  `;

  if (existingList && !existingList.is_system_managed) {
    console.log(`  ⚠ Slug conflict with non-system list "${existingList.title}" — skipping`);
    skipped++;
    continue;
  }

  let listId;
  if (existingList) {
    await sql`
      UPDATE lists SET
        title = ${blueprint.title},
        description = ${bodyText},
        preview_text = ${previewText},
        body_text = ${bodyText},
        cover_image = ${coverImage},
        curated_by = ${SYSTEM_CURATOR},
        tags = ${blueprint.tags},
        is_system_managed = true,
        system_key = ${blueprint.slug},
        managed_by = ${SYSTEM_LIST_MANAGER},
        seed_version = ${SYSTEM_LIST_SEED_VERSION},
        seed_hash = ${seedHash},
        last_seeded_at = NOW(),
        updated_at = NOW()
      WHERE id = ${existingList.id}
    `;
    listId = existingList.id;
    console.log(`  ↺ Updated existing list (${listId})`);
    updated++;
  } else {
    const [newList] = await sql`
      INSERT INTO lists (
        slug,
        title,
        description,
        preview_text,
        body_text,
        cover_image,
        curated_by,
        tags,
        is_public,
        is_system_managed,
        system_key,
        managed_by,
        seed_version,
        seed_hash,
        last_seeded_at,
        created_at,
        updated_at
      )
      VALUES (
        ${blueprint.slug},
        ${blueprint.title},
        ${bodyText},
        ${previewText},
        ${bodyText},
        ${coverImage},
        ${SYSTEM_CURATOR},
        ${blueprint.tags},
        true,
        true,
        ${blueprint.slug},
        ${SYSTEM_LIST_MANAGER},
        ${SYSTEM_LIST_SEED_VERSION},
        ${seedHash},
        NOW(),
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

// ── Cleanup stale editorial lists not in current blueprints ──
// Also clean up lists created by the admin seed button ("Verdict.games Editorial")
// to prevent duplicates between the two seeding systems
const currentSlugs = LIST_BLUEPRINTS.map((b) => b.slug);
const staleLists = await sql`
  SELECT id, slug FROM lists
  WHERE is_system_managed = true
    AND managed_by = ${SYSTEM_LIST_MANAGER}
    AND slug != ALL(${currentSlugs})
`;
let cleaned = 0;
for (const stale of staleLists) {
  await sql`DELETE FROM list_items WHERE list_id = ${stale.id}`;
  await sql`DELETE FROM lists WHERE id = ${stale.id}`;
  console.log(`  🗑 Removed stale list: "${stale.slug}"`);
  cleaned++;
}

console.log("\n═══════════════════════════════════════════");
console.log(`  Created: ${created} | Updated: ${updated} | Skipped: ${skipped} | Cleaned: ${cleaned}`);
console.log("  ✅ Done!");
console.log("═══════════════════════════════════════════\n");

await finishRun(sql, run.id, {
  rows_created: created,
  rows_updated: updated,
  rows_skipped: skipped,
  rows_scanned: LIST_BLUEPRINTS.length,
  metadata: { elapsed: ((Date.now() - startedAt) / 1000).toFixed(1), cleaned },
});
} catch (err) {
  console.error(`❌ Seed curated lists failed:`, err.message);
  await finishRun(sql, run.id, { error_message: err.message });
  await releaseLock(sql, 'seed-curated-lists');
  await closeDb(sql, 'seed-curated-lists');
  process.exit(1);
}

await releaseLock(sql, 'seed-curated-lists');
await closeDb(sql, 'seed-curated-lists');
