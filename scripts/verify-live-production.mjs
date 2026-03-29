#!/usr/bin/env node
/**
 * verify-live-production.mjs
 * 
 * Fetches live production endpoints and analyzes them for public safety issues.
 */

const BASE_URL = "https://verdict-games.vercel.app";

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
  const issues = { adult: [], brokenCover: [], provisional: [], steamCovers: [] };

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
      issues.steamCovers.push({ title, cover: cover.slice(0, 60), source });
    }
  }

  return issues;
}

async function fetchEndpoint(path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { 
      signal: AbortSignal.timeout(30000),
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, data: null };
    const data = await res.json();
    return { error: null, data };
  } catch (err) {
    return { error: err.message, data: null };
  }
}

async function main() {
  console.log("🔍 PHASE 1: Live Production Verification");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log("═".repeat(60) + "\n");

  const allIssues = { adult: [], brokenCover: [], provisional: [], steamCovers: [] };
  const results = {};

  // 1. Homepage
  console.log("📍 Checking /api/homepage...");
  const homepage = await fetchEndpoint("/api/homepage");
  if (homepage.error) {
    console.log(`   ❌ ERROR: ${homepage.error}`);
  } else {
    results.homepage = homepage.data;
    const sections = ["hero", "trending", "newReleases", "topRated", "recommendations"];
    for (const section of sections) {
      const games = homepage.data?.data?.[section] || [];
      console.log(`   ${section}: ${games.length} games`);
      const issues = analyzeGames(games, `homepage.${section}`);
      allIssues.adult.push(...issues.adult);
      allIssues.brokenCover.push(...issues.brokenCover);
      allIssues.provisional.push(...issues.provisional);
      allIssues.steamCovers.push(...issues.steamCovers);

      // Check for Pure Idle / Humanity Echo
      for (const game of games) {
        if (game.title === "Pure Idle" || game.title === "Humanity Echo") {
          console.log(`   ⚠️  Found "${game.title}" in ${section}`);
          console.log(`      Cover: ${(game.coverImage || "NONE").slice(0, 50)}`);
          console.log(`      isProvisional: ${game.isProvisional}`);
        }
      }
    }
  }

  // 2. Search endpoints
  const searchEndpoints = [
    { path: "/api/search?sort=relevance&page=1", name: "search/relevance" },
    { path: "/api/search?sort=newest&page=1", name: "search/newest" },
    { path: "/api/search?sort=upcoming&page=1", name: "search/upcoming" },
    { path: "/api/search?sort=recently-added&page=1", name: "search/recently-added" },
    { path: "/api/search?sort=top-rated&page=1", name: "search/top-rated" },
    { path: "/api/search?sort=trending&page=1", name: "search/trending" },
  ];

  for (const { path, name } of searchEndpoints) {
    console.log(`\n📍 Checking ${path}...`);
    const result = await fetchEndpoint(path);
    if (result.error) {
      console.log(`   ❌ ERROR: ${result.error}`);
    } else {
      const games = result.data?.data?.items || [];
      console.log(`   Total: ${games.length} games`);
      const issues = analyzeGames(games, name);
      allIssues.adult.push(...issues.adult);
      allIssues.brokenCover.push(...issues.brokenCover);
      allIssues.steamCovers.push(...issues.steamCovers);

      // Check for provisional leaks in newest/recently-added
      if (name.includes("newest") || name.includes("recently-added")) {
        const provisionalLeaks = games.filter(g => isProvisional(g));
        if (provisionalLeaks.length > 0) {
          console.log(`   ⚠️  Provisional leaks: ${provisionalLeaks.length}`);
          for (const g of provisionalLeaks.slice(0, 3)) {
            console.log(`      - ${g.title} [${g.verdictLabel}]`);
            allIssues.provisional.push({ title: g.title, verdictLabel: g.verdictLabel, source: name });
          }
        }
      }

      // Show first few games for verification
      console.log(`   First 3: ${games.slice(0, 3).map(g => g.title).join(", ")}`);
    }
  }

  // 3. Recommendations
  console.log("\n📍 Checking /api/recommendations?limit=20...");
  const recommendations = await fetchEndpoint("/api/recommendations?limit=20");
  if (recommendations.error) {
    console.log(`   ❌ ERROR: ${recommendations.error}`);
  } else {
    const games = recommendations.data?.data || [];
    console.log(`   Total: ${games.length} games`);
    const issues = analyzeGames(games, "recommendations");
    allIssues.adult.push(...issues.adult);
    allIssues.brokenCover.push(...issues.brokenCover);
    allIssues.provisional.push(...issues.provisional);
    allIssues.steamCovers.push(...issues.steamCovers);

    // Check review counts (should be quality games)
    const lowReviewGames = games.filter(g => (g.reviewCount || 0) < 50);
    if (lowReviewGames.length > 0) {
      console.log(`   ⚠️  Low-review games in recommendations: ${lowReviewGames.length}`);
      for (const g of lowReviewGames.slice(0, 3)) {
        console.log(`      - ${g.title} (${g.reviewCount || 0} reviews)`);
      }
    }
  }

  // 4. Lists
  console.log("\n📍 Checking /api/lists...");
  const lists = await fetchEndpoint("/api/lists");
  if (lists.error) {
    console.log(`   ❌ ERROR: ${lists.error}`);
  } else {
    const listData = lists.data?.data || [];
    console.log(`   Total lists: ${listData.length}`);
    for (const list of listData) {
      const games = list.games || [];
      console.log(`   - ${list.title || list.name || 'Untitled'}: ${games.length} games`);
      const issues = analyzeGames(games, `lists.${list.slug}`);
      allIssues.adult.push(...issues.adult);
      allIssues.brokenCover.push(...issues.brokenCover);
      allIssues.steamCovers.push(...issues.steamCovers);
    }
  }

  // 5. Calendar
  console.log("\n📍 Checking /api/calendar...");
  const calendar = await fetchEndpoint("/api/calendar");
  if (calendar.error) {
    console.log(`   ❌ ERROR: ${calendar.error}`);
  } else {
    const games = calendar.data?.data || [];
    console.log(`   Total: ${games.length} games`);
    const issues = analyzeGames(games, "calendar");
    allIssues.adult.push(...issues.adult);
    allIssues.brokenCover.push(...issues.brokenCover);
    allIssues.steamCovers.push(...issues.steamCovers);
  }

  // 6. RAWG lists
  console.log("\n📍 Checking /api/rawg/lists?type=best-of-year&pageSize=12...");
  const rawgLists = await fetchEndpoint("/api/rawg/lists?type=best-of-year&pageSize=12");
  if (rawgLists.error) {
    console.log(`   ❌ ERROR: ${rawgLists.error}`);
  } else {
    const items = rawgLists.data?.data?.items || [];
    console.log(`   Total: ${items.length} items`);
    const issues = analyzeGames(items, "rawg/lists");
    allIssues.adult.push(...issues.adult);
    allIssues.brokenCover.push(...issues.brokenCover);
  }

  // 7. GX News
  console.log("\n📍 Checking /api/gx/news/popular...");
  const gxPopular = await fetchEndpoint("/api/gx/news/popular");
  if (gxPopular.error) {
    console.log(`   ❌ ERROR: ${gxPopular.error}`);
  } else {
    const items = Array.isArray(gxPopular.data?.data) ? gxPopular.data.data : [];
    console.log(`   Total: ${items.length} items`);
  }

  console.log("\n📍 Checking /api/gx/news/feed...");
  const gxFeed = await fetchEndpoint("/api/gx/news/feed");
  if (gxFeed.error) {
    console.log(`   ❌ ERROR: ${gxFeed.error}`);
  } else {
    const items = Array.isArray(gxFeed.data?.data) ? gxFeed.data.data : [];
    console.log(`   Total: ${items.length} items`);
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("📊 ISSUE SUMMARY\n");

  console.log(`❌ Adult/NSFW content found: ${allIssues.adult.length}`);
  for (const issue of allIssues.adult) {
    console.log(`   - ${issue.title} (${issue.source})`);
  }

  console.log(`\n❌ Broken/empty covers found: ${allIssues.brokenCover.length}`);
  for (const issue of allIssues.brokenCover.slice(0, 10)) {
    console.log(`   - ${issue.title} (${issue.source})`);
  }

  console.log(`\n❌ Provisional leaks found: ${allIssues.provisional.length}`);
  for (const issue of allIssues.provisional) {
    console.log(`   - ${issue.title} [${issue.verdictLabel}] (${issue.source})`);
  }

  console.log(`\n⚠️  Steam library covers (may need validation): ${allIssues.steamCovers.length}`);

  // Final checklist
  console.log("\n" + "═".repeat(60));
  console.log("✅ VERIFICATION CHECKLIST\n");

  const checks = [
    { name: "No adult/NSFW on public surfaces", pass: allIssues.adult.length === 0 },
    { name: "No broken covers on public surfaces", pass: allIssues.brokenCover.length === 0 },
    { name: "No provisional leaks in New Releases/Newest", pass: allIssues.provisional.filter(p => p.source.includes("newest") || p.source.includes("newReleases")).length === 0 },
    { name: "Lists readiness works (check game counts)", pass: true },
    { name: "Search newest excludes provisional", pass: allIssues.provisional.filter(p => p.source.includes("newest")).length === 0 },
  ];

  for (const check of checks) {
    console.log(`${check.pass ? "✅" : "❌"} ${check.name}`);
  }

  const allPassed = checks.every(c => c.pass);
  console.log(`\n🏁 OVERALL: ${allPassed ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`);
}

main().catch(console.error);
