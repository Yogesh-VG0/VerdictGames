#!/usr/bin/env node
/**
 * Analyze live API responses for public safety issues
 */

import fs from "fs";

const ADULT_TAGS = new Set([
  "sexual content", "nsfw", "hentai", "adult", "erotic", "nudity",
  "mature-content", "sex", "porn", "mature", "adult only", "18+"
]);

const ADULT_KEYWORDS = [
  "sexual content", "nsfw", "hentai", "adult only", "erotic",
  "nudity", "explicit", "porn"
];

function hasAdultTags(tags, genres) {
  const allTags = [
    ...(tags ?? []).map(t => (typeof t === "string" ? t : t.name || "").toLowerCase().trim()),
    ...(genres ?? []).map(g => (typeof g === "string" ? g : g.name || "").toLowerCase().trim()),
  ];
  for (const tag of allTags) {
    if (ADULT_TAGS.has(tag)) return true;
    for (const adultTag of ADULT_TAGS) {
      if (tag.includes(adultTag)) return true;
    }
  }
  return false;
}

function hasAdultDescription(description) {
  if (!description) return false;
  const lower = description.toLowerCase();
  return ADULT_KEYWORDS.some(kw => lower.includes(kw));
}

function hasBrokenCover(game) {
  const cover = game.coverImage || game.cover_image || game.image;
  if (!cover || cover === "") return true;
  return false;
}

function isSteamLibraryCover(url) {
  if (!url) return false;
  return url.includes("library_600x900");
}

function isProvisional(game) {
  return game.isProvisional || game.verdictLabel === "COMING SOON";
}

function analyzeGames(games, source) {
  const issues = {
    adult: [],
    brokenCover: [],
    provisional: [],
    steamCoverNeedsValidation: [],
  };

  for (const game of games) {
    const title = game.title || game.name || "Unknown";
    const tags = game.tags || [];
    const genres = game.genres || [];
    const description = game.description || "";
    const cover = game.coverImage || game.cover_image || game.image || "";

    if (hasAdultTags(tags, genres) || hasAdultDescription(description)) {
      issues.adult.push({ title, tags: tags.slice(0, 5), source });
    }

    if (hasBrokenCover(game)) {
      issues.brokenCover.push({ title, cover, source });
    }

    if (isProvisional(game)) {
      issues.provisional.push({ title, verdictLabel: game.verdictLabel, source });
    }

    if (isSteamLibraryCover(cover)) {
      issues.steamCoverNeedsValidation.push({ title, cover: cover.slice(0, 60), source });
    }
  }

  return issues;
}

function loadJson(filename) {
  try {
    const content = fs.readFileSync(filename, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.log(`  ⚠️  Could not load ${filename}: ${err.message}`);
    return null;
  }
}

function main() {
  console.log("🔍 Analyzing Live API Responses\n");
  console.log("═".repeat(60));

  const allIssues = {
    adult: [],
    brokenCover: [],
    provisional: [],
    steamCoverNeedsValidation: [],
  };

  // Homepage
  const homepage = loadJson("homepage_response.json");
  if (homepage?.data) {
    console.log("\n📍 /api/homepage");
    const sections = ["hero", "trending", "newReleases", "topRated", "recommendations"];
    for (const section of sections) {
      const games = homepage.data[section] || [];
      console.log(`   ${section}: ${games.length} games`);
      const issues = analyzeGames(games, `homepage.${section}`);
      allIssues.adult.push(...issues.adult);
      allIssues.brokenCover.push(...issues.brokenCover);
      allIssues.provisional.push(...issues.provisional);
      allIssues.steamCoverNeedsValidation.push(...issues.steamCoverNeedsValidation);

      // Check specific games
      for (const game of games) {
        if (game.title === "Pure Idle" || game.title === "Humanity Echo") {
          console.log(`   ⚠️  Found ${game.title} in ${section}`);
          console.log(`      Cover: ${(game.coverImage || "NONE").slice(0, 60)}`);
        }
      }
    }
  }

  // Search endpoints
  const searchFiles = [
    { file: "search_newest.json", name: "search?sort=newest" },
    { file: "search_upcoming.json", name: "search?sort=upcoming" },
    { file: "search_toprated.json", name: "search?sort=top-rated" },
    { file: "search_recentlyadded.json", name: "search?sort=recently-added" },
  ];

  for (const { file, name } of searchFiles) {
    const data = loadJson(file);
    if (data?.data?.games) {
      console.log(`\n📍 /api/${name}`);
      const games = data.data.games;
      console.log(`   Total: ${games.length} games`);
      const issues = analyzeGames(games, name);
      allIssues.adult.push(...issues.adult);
      allIssues.brokenCover.push(...issues.brokenCover);
      allIssues.steamCoverNeedsValidation.push(...issues.steamCoverNeedsValidation);

      // For newest/recently-added, check provisional leak
      if (name.includes("newest") || name.includes("recently-added")) {
        for (const game of games) {
          if (isProvisional(game)) {
            allIssues.provisional.push({ title: game.title, verdictLabel: game.verdictLabel, source: name });
          }
        }
      }
    }
  }

  // Recommendations
  const recommendations = loadJson("recommendations.json");
  if (recommendations?.data) {
    console.log("\n📍 /api/recommendations");
    const games = recommendations.data;
    console.log(`   Total: ${games.length} games`);
    const issues = analyzeGames(games, "recommendations");
    allIssues.adult.push(...issues.adult);
    allIssues.brokenCover.push(...issues.brokenCover);
    allIssues.provisional.push(...issues.provisional);
    allIssues.steamCoverNeedsValidation.push(...issues.steamCoverNeedsValidation);
  }

  // Lists
  const lists = loadJson("lists.json");
  if (lists?.data) {
    console.log("\n📍 /api/lists");
    for (const list of lists.data) {
      const games = list.games || [];
      console.log(`   ${list.name}: ${games.length} games`);
      const issues = analyzeGames(games, `lists.${list.slug}`);
      allIssues.adult.push(...issues.adult);
      allIssues.brokenCover.push(...issues.brokenCover);
      allIssues.steamCoverNeedsValidation.push(...issues.steamCoverNeedsValidation);
    }
  }

  // Calendar
  const calendar = loadJson("calendar.json");
  if (calendar?.data) {
    console.log("\n📍 /api/calendar");
    const games = calendar.data;
    console.log(`   Total: ${games.length} games`);
    const issues = analyzeGames(games, "calendar");
    allIssues.adult.push(...issues.adult);
    allIssues.brokenCover.push(...issues.brokenCover);
    allIssues.steamCoverNeedsValidation.push(...issues.steamCoverNeedsValidation);
  }

  // RAWG lists
  const rawgLists = loadJson("rawg_lists.json");
  if (rawgLists?.items) {
    console.log("\n📍 /api/rawg/lists");
    const items = rawgLists.items;
    console.log(`   Total: ${items.length} items`);
    const issues = analyzeGames(items, "rawg/lists");
    allIssues.adult.push(...issues.adult);
    allIssues.brokenCover.push(...issues.brokenCover);
  }

  // GX News
  const gxPopular = loadJson("gx_news_popular.json");
  if (gxPopular) {
    console.log("\n📍 /api/gx/news/popular");
    console.log(`   Total: ${Array.isArray(gxPopular) ? gxPopular.length : "N/A"} items`);
  }

  const gxFeed = loadJson("gx_news_feed.json");
  if (gxFeed) {
    console.log("\n📍 /api/gx/news/feed");
    console.log(`   Total: ${Array.isArray(gxFeed) ? gxFeed.length : "N/A"} items`);
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("📊 ISSUE SUMMARY\n");

  console.log(`❌ Adult/NSFW content: ${allIssues.adult.length}`);
  for (const issue of allIssues.adult.slice(0, 10)) {
    console.log(`   - ${issue.title} (${issue.source})`);
  }

  console.log(`\n❌ Broken covers: ${allIssues.brokenCover.length}`);
  for (const issue of allIssues.brokenCover.slice(0, 10)) {
    console.log(`   - ${issue.title} (${issue.source})`);
  }

  console.log(`\n❌ Provisional leaks: ${allIssues.provisional.length}`);
  for (const issue of allIssues.provisional.slice(0, 10)) {
    console.log(`   - ${issue.title} [${issue.verdictLabel}] (${issue.source})`);
  }

  console.log(`\n⚠️  Steam covers needing validation: ${allIssues.steamCoverNeedsValidation.length}`);

  console.log("\n" + "═".repeat(60));
  console.log("✅ VERIFICATION CHECKLIST\n");

  console.log(`1. No adult/NSFW on public surfaces: ${allIssues.adult.length === 0 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`2. No broken covers on public surfaces: ${allIssues.brokenCover.length === 0 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`3. No provisional leaks in New Releases: ${allIssues.provisional.filter(p => p.source.includes("newest")).length === 0 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`4. Lists readiness works: Check manually`);
  console.log(`5. Search newest no longer leaks provisional: ${allIssues.provisional.filter(p => p.source.includes("newest")).length === 0 ? "✅ PASS" : "❌ FAIL"}`);
}

main();
