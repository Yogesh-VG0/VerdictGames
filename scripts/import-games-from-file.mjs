import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { connectDb } from "./lib/db-connect.mjs";
import { ingestGameDirect, slugify } from "./lib/ingest-pipeline.mjs";
import { acquireLock, finishRun, releaseLock, startRun } from "./lib/scheduler-logger.mjs";

try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(idx + 1).trim();
  }
} catch {}

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, value] = arg.slice(2).split("=");
      return [key, value ?? true];
    })
);

const FILE_PATH = path.resolve(args.file ?? "unique_game_names_2339.txt");
const FILE_KEY = path.basename(FILE_PATH, path.extname(FILE_PATH))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "games";
const LIMIT = Math.max(0, parseInt(args.limit ?? "0", 10) || 0);
const DELAY_MS = Math.max(0, parseInt(args["delay-ms"] ?? "300", 10) || 0);
const RETRY_COUNT = Math.max(0, parseInt(args["retry-count"] ?? "2", 10) || 0);
const DRY_RUN = args["dry-run"] === true;
const NO_RESUME = args["no-resume"] === true;
const FORCE_REFRESH = args["force-refresh"] === true;
const START_AT = Math.max(1, parseInt(args["start-at"] ?? "1", 10) || 1);
const CHECKPOINT_PATH = path.resolve(args.checkpoint ?? `.import-games-${FILE_KEY}-checkpoint.json`);
const FAILURES_PATH = path.resolve(args["failures-file"] ?? `.import-games-${FILE_KEY}-failures.json`);

if (!existsSync(FILE_PATH)) {
  console.error(`✗ Input file not found: ${FILE_PATH}`);
  process.exit(1);
}

const sql = connectDb("import-games-from-file");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function persistCheckpoint(nextIndex) {
  if (!DRY_RUN) {
    saveCheckpoint(nextIndex);
  }
}

function stripDiacritics(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function stripListPrefix(value) {
  return value.replace(/^\d+\.\s*/, "");
}

function cleanInputLine(value) {
  return normalizeWhitespace(stripListPrefix(value.replace(/^\uFEFF/, "")));
}

function stripTrailingYear(value) {
  return normalizeWhitespace(value.replace(/\s*\((?:19|20)\d{2}\)\s*$/g, " "));
}

function hasExplicitYear(value) {
  return /\((?:19|20)\d{2}\)/.test(value);
}

function stripSlugYear(value) {
  return value.replace(/-(?:19|20)\d{2}$/g, "");
}

function normTitle(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isUsefulAliasPart(value) {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return false;
  if (!/[a-z]/i.test(trimmed)) return false;
  const compact = normTitle(trimmed);
  if (!compact) return false;
  if (/^[A-Z0-9\s.'!&:+-]+$/.test(trimmed) && compact.length <= 3) return false;
  return true;
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const trimmed = normalizeWhitespace(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }
  return output;
}

function romanToArabic(value) {
  return value
    .replace(/\bXIII\b/g, "13")
    .replace(/\bXII\b/g, "12")
    .replace(/\bXI\b/g, "11")
    .replace(/\bVIII\b/g, "8")
    .replace(/\bVII\b/g, "7")
    .replace(/\bVI\b/g, "6")
    .replace(/\bIV\b/g, "4")
    .replace(/\bIII\b/g, "3")
    .replace(/\bII\b/g, "2")
    .replace(/\bIX\b/g, "9");
}

function expandQueryVariants(value) {
  const base = normalizeWhitespace(value).replace(/[’]/g, "'").replace(/[×]/g, "x");
  const noYear = normalizeWhitespace(base.replace(/\s*\((?:19|20)\d{2}\)\s*/g, " "));
  const folded = normalizeWhitespace(stripDiacritics(base));
  const foldedNoYear = normalizeWhitespace(stripDiacritics(noYear));
  return uniqueStrings([
    base,
    noYear,
    folded,
    foldedNoYear,
    romanToArabic(base),
    romanToArabic(noYear),
    romanToArabic(folded),
    romanToArabic(foldedNoYear),
  ]);
}

function expandLookupVariants(value, includeYearless) {
  const base = normalizeWhitespace(value).replace(/[’]/g, "'").replace(/[×]/g, "x");
  const folded = normalizeWhitespace(stripDiacritics(base));
  const variants = [
    base,
    folded,
    romanToArabic(base),
    romanToArabic(folded),
  ];

  if (includeYearless) {
    const noYear = stripTrailingYear(base);
    const foldedNoYear = normalizeWhitespace(stripDiacritics(noYear));
    variants.push(noYear, foldedNoYear, romanToArabic(noYear), romanToArabic(foldedNoYear));
  }

  return uniqueStrings(variants);
}

const QUERY_OVERRIDES = new Map([
  [normTitle("The Witcher III: Wild Hunt"), ["The Witcher 3: Wild Hunt"]],
  [normTitle("Divinity: Original Sin II"), ["Divinity: Original Sin 2"]],
  [normTitle("Ōkami"), ["Okami"]],
  [normTitle("GoldenEye 007"), ["GoldenEye 007 (1997)"]],
  [normTitle("Counter-Strike / Counter-Strike 1.6"), ["Counter-Strike 1.6", "Counter-Strike"]],
  [normTitle("Persona 4 / Shin Megami Tensei: Persona 4"), ["Persona 4", "Shin Megami Tensei: Persona 4"]],
  [normTitle("Mario Kart 8 / Mario Kart 8 Deluxe"), ["Mario Kart 8 Deluxe", "Mario Kart 8"]],
  [normTitle("EarthBound / Mother 2: Gīgu no Gyakushū"), ["EarthBound"]],
  [normTitle("X-COM: UFO Defense / UFO: Enemy Unknown"), ["X-COM: UFO Defense", "UFO: Enemy Unknown"]],
  [normTitle("Secret of Mana / Seiken Densetsu 2"), ["Secret of Mana"]],
  [normTitle("Rez / Rez HD / Rez Infinite"), ["Rez Infinite", "Rez HD", "Rez"]],
  [normTitle("Hitman 3 / World of Assassination"), ["Hitman World of Assassination", "Hitman 3"]],
  [normTitle("The Legend of Zelda: Link's Awakening / DX"), ["The Legend of Zelda: Link's Awakening DX", "The Legend of Zelda: Link's Awakening"]],
  [normTitle("Wipeout 2097 / Wipeout XL"), ["Wipeout 2097"]],
  [normTitle("Pokémon Red/Blue/Yellow"), ["Pokemon Red"]],
  [normTitle("Pokémon Gold/Silver/Crystal"), ["Pokemon Gold"]],
  [normTitle("Pokémon HeartGold/SoulSilver"), ["Pokemon HeartGold"]],
  [normTitle("Pokémon Ruby/Sapphire/Emerald"), ["Pokemon Ruby"]],
  [normTitle("Pokémon Diamond/Pearl"), ["Pokemon Diamond"]],
  [normTitle("Pokémon Black/White"), ["Pokemon Black"]],
  [normTitle("Pokémon Black 2/White 2"), ["Pokemon Black 2"]],
  [normTitle("Pokémon X/Y"), ["Pokemon X"]],
  [normTitle("Pokémon Sword/Shield"), ["Pokemon Sword"]],
  [normTitle("Pokémon FireRed/LeafGreen"), ["Pokemon FireRed"]],
  [normTitle("Pokémon: Let's Go Eevee!/Pikachu!"), ["Pokemon: Let's Go Eevee!", "Pokemon: Let's Go Pikachu!"]],
]);

function buildSeedQueries(line) {
  const override = QUERY_OVERRIDES.get(normTitle(line));
  const seeds = [];

  if (override) {
    seeds.push(...override);
  } else {
    if (/\s+\/\s+/.test(line)) {
      seeds.push(...line.split(/\s+\/\s+/).filter(isUsefulAliasPart));
    }
    if (line.includes("/")) {
      const compactFirst = normalizeWhitespace(line.slice(0, line.indexOf("/")));
      if (isUsefulAliasPart(compactFirst)) seeds.push(compactFirst);
    }
    seeds.push(line);
  }

  return uniqueStrings(seeds);
}

function buildLookupQueries(line) {
  const seeds = buildSeedQueries(line);
  const includeYearless = !hasExplicitYear(line);
  const expanded = uniqueStrings(seeds.flatMap((seed) => expandLookupVariants(seed, includeYearless)));

  return expanded.map((query) => ({
    query,
    expectedSlug: slugify(stripDiacritics(query).replace(/[’]/g, "'")),
  }));
}

function buildCandidateQueries(line) {
  const seeds = buildSeedQueries(line);
  const expanded = uniqueStrings(seeds.flatMap(expandQueryVariants));
  return expanded.map((query) => ({
    query,
    expectedSlug: slugify(stripDiacritics(query).replace(/[’]/g, "'")),
  }));
}

const MATCH_STOPWORDS = new Set(["the", "a", "an", "of", "and", "or", "to", "for", "in", "on", "at", "by", "with"]);
const MATCH_IGNORABLE_EXTRAS = new Set([
  ...MATCH_STOPWORDS,
  "edition",
  "gold",
  "deluxe",
  "ultimate",
  "complete",
  "collection",
  "remastered",
  "remaster",
  "remake",
  "hd",
  "bundle",
  "pack",
  "goty",
  "anniversary",
  "enhanced",
  "definitive",
  "director",
  "directors",
  "cut",
  "standard",
  "premium",
  "version",
]);

function normalizePhrase(value) {
  return normalizeWhitespace(stripDiacritics(stripTrailingYear(value ?? "")))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeForMatch(value) {
  const normalized = normalizePhrase(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function significantTokens(value) {
  return tokenizeForMatch(value).filter((token) => !MATCH_STOPWORDS.has(token));
}

function numericLikeTokens(value) {
  return tokenizeForMatch(value).filter((token) => /[0-9]/.test(token) || /^(?:ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii)$/i.test(token));
}

function validateResolvedMatch(sourceTitle, matchedTitle) {
  if (!matchedTitle) return { accepted: true, reason: null };

  const inputPhrase = normalizePhrase(sourceTitle);
  const matchedPhrase = normalizePhrase(matchedTitle);
  if (!inputPhrase || !matchedPhrase) return { accepted: true, reason: null };
  if (inputPhrase === matchedPhrase) return { accepted: true, reason: null };

  const inputTokens = significantTokens(sourceTitle);
  const matchedTokens = significantTokens(matchedTitle);
  const matchedSet = new Set(matchedTokens);
  const inputSet = new Set(inputTokens);
  const missing = inputTokens.filter((token) => !matchedSet.has(token));
  const extra = matchedTokens.filter((token) => !inputSet.has(token));

  const missingAreIgnorable = missing.length > 0 && missing.every((token) => MATCH_IGNORABLE_EXTRAS.has(token));
  const extraAreIgnorable = extra.length > 0 && extra.every((token) => MATCH_IGNORABLE_EXTRAS.has(token));
  const extraAreOnlyNumbers = extra.length > 0 && extra.every((token) => /^\d+$/.test(token));

  if (missing.length === 0 && extraAreIgnorable) {
    return { accepted: true, reason: null };
  }

  if (extra.length === 0 && missingAreIgnorable) {
    return { accepted: true, reason: null };
  }

  if (missingAreIgnorable && extraAreIgnorable) {
    return { accepted: true, reason: null };
  }

  if ((missing.length === 0 || missingAreIgnorable) && extraAreOnlyNumbers && inputTokens.length >= 3) {
    return { accepted: true, reason: null };
  }

  const inputNumeric = uniqueStrings(numericLikeTokens(sourceTitle));
  const matchedNumeric = uniqueStrings(numericLikeTokens(matchedTitle));
  if (inputNumeric.join("|") !== matchedNumeric.join("|")) {
    return { accepted: false, reason: `numeric mismatch (${inputNumeric.join(",") || "none"} vs ${matchedNumeric.join(",") || "none"})` };
  }

  if (missing.length === 0 && extra.every((token) => MATCH_IGNORABLE_EXTRAS.has(token))) {
    return { accepted: true, reason: null };
  }

  if (inputTokens.length <= 2 && extra.length > 0) {
    return { accepted: false, reason: `ambiguous short-title expansion (${extra.slice(0, 4).join(",")})` };
  }

  return {
    accepted: false,
    reason: `token mismatch (missing: ${missing.slice(0, 4).join(",") || "none"}; extra: ${extra.slice(0, 4).join(",") || "none"})`,
  };
}

function isRetryableAttemptMessage(message) {
  return /(\b429\b|\b502\b|\b503\b|\b504\b|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|timeout|timed out|temporar)/i.test(message ?? "");
}

async function rollbackCreatedGame(gameId) {
  if (!gameId) return;
  await sql`DELETE FROM game_sources WHERE game_id = ${gameId}`.catch(() => {});
  await sql`DELETE FROM games WHERE id = ${gameId}`;
}

function loadCheckpoint() {
  if (NO_RESUME || !existsSync(CHECKPOINT_PATH)) return null;
  try {
    const checkpoint = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
    if (checkpoint?.filePath && path.resolve(checkpoint.filePath) !== FILE_PATH) return null;
    return checkpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(nextIndex) {
  writeFileSync(
    CHECKPOINT_PATH,
    JSON.stringify(
      {
        filePath: FILE_PATH,
        nextIndex,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

function clearCheckpoint() {
  if (existsSync(CHECKPOINT_PATH)) {
    writeFileSync(CHECKPOINT_PATH, "{}\n");
  }
}

function writeFailures(failures) {
  writeFileSync(
    FAILURES_PATH,
    JSON.stringify(
      {
        filePath: FILE_PATH,
        totalFailures: failures.length,
        generatedAt: new Date().toISOString(),
        failures,
      },
      null,
      2
    )
  );
}

const rawLines = readFileSync(FILE_PATH, "utf8")
  .split(/\r?\n/)
  .map((line) => cleanInputLine(line))
  .filter(Boolean);

const uniqueLines = [];
const seenLines = new Set();
for (const line of rawLines) {
  const key = line.toLowerCase();
  if (seenLines.has(key)) continue;
  seenLines.add(key);
  uniqueLines.push(line);
}

const checkpoint = loadCheckpoint();
const startIndex = Math.max(START_AT - 1, checkpoint?.nextIndex ? Math.max(0, checkpoint.nextIndex - 1) : 0);
const maxToProcess = LIMIT > 0 ? LIMIT : Number.POSITIVE_INFINITY;

console.log("═══════════════════════════════════════════");
console.log("  VERDICT.GAMES — Import Games From File");
console.log(`  File: ${path.relative(process.cwd(), FILE_PATH) || FILE_PATH}`);
console.log(`  Titles: ${uniqueLines.length} | Start: ${startIndex + 1} | Delay: ${DELAY_MS}ms${DRY_RUN ? " | DRY RUN" : ""}${FORCE_REFRESH ? " | FORCE REFRESH" : ""}`);
console.log("═══════════════════════════════════════════\n");

let existingRows = [];
let schedulerRun = { id: null };
let locked = false;
let caughtError = null;

try {
  if (!DRY_RUN) {
    locked = await acquireLock(sql, "import-games-from-file");
    if (!locked) {
      await sql.end();
      process.exit(0);
    }
    schedulerRun = await startRun(sql, "import-games-from-file", {
      filePath: FILE_PATH,
      totalTitles: uniqueLines.length,
      startAt: startIndex + 1,
      delayMs: DELAY_MS,
      forceRefresh: FORCE_REFRESH,
    });
  }

  console.log("📦 Loading existing games from DB...");
  existingRows = await sql`SELECT slug, title FROM games`;
  const existingSlugs = new Set(existingRows.map((row) => row.slug));
  const existingSlugsYearless = new Set(existingRows.map((row) => stripSlugYear(row.slug ?? "")).filter(Boolean));
  const existingTitles = new Set(existingRows.map((row) => normTitle(row.title ?? "")));
  const existingTitlesYearless = new Set(existingRows.map((row) => normTitle(stripTrailingYear(row.title ?? ""))).filter(Boolean));
  console.log(`  ${existingRows.length} games already in DB\n`);

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (let index = startIndex; index < uniqueLines.length && processed < maxToProcess; index++) {
    const line = uniqueLines[index];
    const label = `[${index + 1}/${uniqueLines.length}]`;
    const lookupCandidates = buildLookupQueries(line);
    const candidates = buildCandidateQueries(line);
    const allowYearlessExistingMatch = !hasExplicitYear(line);
    const existingCandidate = FORCE_REFRESH ? null : lookupCandidates.find((candidate) => {
      if (existingTitles.has(normTitle(candidate.query))) return true;
      if (existingSlugs.has(candidate.expectedSlug)) return true;
      if (allowYearlessExistingMatch && existingTitlesYearless.has(normTitle(stripTrailingYear(candidate.query)))) return true;
      if (allowYearlessExistingMatch && existingSlugsYearless.has(stripSlugYear(candidate.expectedSlug))) return true;
      return false;
    });

    if (existingCandidate) {
      skipped++;
      processed++;
      console.log(`⏭  ${label} ${line} — already present via "${existingCandidate.query}"`);
      persistCheckpoint(index + 2);
      continue;
    }

    if (DRY_RUN) {
      skipped++;
      processed++;
      console.log(`🔎 ${label} ${line} — candidates: ${candidates.map((candidate) => candidate.query).join(" | ")}`);
      continue;
    }

    let successResult = null;
    const attempts = [];

    for (const candidate of candidates) {
      for (let attemptNumber = 0; attemptNumber <= RETRY_COUNT; attemptNumber++) {
        try {
          const result = await ingestGameDirect(sql, candidate.query, {
            forceRefresh: FORCE_REFRESH,
            expectedSlug: candidate.expectedSlug,
          });

          const validation = result.success ? validateResolvedMatch(candidate.query, result.title) : { accepted: true, reason: null };
          if (result.success && !validation.accepted) {
            if (!result.alreadyExisted) {
              await rollbackCreatedGame(result.gameId);
            }
            attempts.push({
              query: candidate.query,
              resolvedTitle: result.title,
              message: `Rejected matched title \"${result.title ?? "unknown"}\" (${validation.reason})`,
              success: false,
              alreadyExisted: result.alreadyExisted,
            });
            break;
          }

          attempts.push({
            query: candidate.query,
            resolvedTitle: result.title,
            message: result.message,
            success: result.success,
            alreadyExisted: result.alreadyExisted,
          });

          if (result.success) {
            successResult = { candidate, result };
            break;
          }

          if (attemptNumber < RETRY_COUNT && isRetryableAttemptMessage(result.message)) {
            await sleep(Math.max(750, DELAY_MS) * (attemptNumber + 1));
            continue;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          attempts.push({
            query: candidate.query,
            message,
            success: false,
            alreadyExisted: false,
          });
          if (attemptNumber < RETRY_COUNT && isRetryableAttemptMessage(message)) {
            await sleep(Math.max(750, DELAY_MS) * (attemptNumber + 1));
            continue;
          }
        }
        break;
      }

      if (successResult) {
        break;
      }

      if (DELAY_MS > 0) {
        await sleep(DELAY_MS);
      }
    }

    if (successResult) {
      const { candidate, result } = successResult;
      const status = result.alreadyExisted ? "⏭" : FORCE_REFRESH ? "↻" : "✓";
      if (result.alreadyExisted) skipped++;
      else created++;
      processed++;
      existingSlugs.add(result.slug ?? candidate.expectedSlug);
      existingSlugsYearless.add(stripSlugYear(result.slug ?? candidate.expectedSlug));
      if (result.title) {
        existingTitles.add(normTitle(result.title));
        existingTitlesYearless.add(normTitle(stripTrailingYear(result.title)));
      }
      for (const item of candidates) {
        existingTitles.add(normTitle(item.query));
        existingTitlesYearless.add(normTitle(stripTrailingYear(item.query)));
        existingSlugs.add(item.expectedSlug);
        existingSlugsYearless.add(stripSlugYear(item.expectedSlug));
      }
      console.log(`${status}  ${label} ${line} — ${result.message} via "${candidate.query}"`);
      persistCheckpoint(index + 2);
      if (DELAY_MS > 0) {
        await sleep(DELAY_MS);
      }
      continue;
    }

    failed++;
    processed++;
    const failure = {
      line,
      lineNumber: index + 1,
      candidates: candidates.map((candidate) => candidate.query),
      attempts,
    };
    failures.push(failure);
    writeFailures(failures);
    console.log(`✗  ${label} ${line} — no successful match`);
    persistCheckpoint(index + 2);
    if (DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  if (failed === 0 && existsSync(FAILURES_PATH)) {
    writeFailures([]);
  }

  const completedAll = startIndex + processed >= uniqueLines.length || maxToProcess === processed && startIndex + processed >= uniqueLines.length;
  if (completedAll) {
    clearCheckpoint();
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Processed: ${processed} | Created: ${created} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`  Failures file: ${path.relative(process.cwd(), FAILURES_PATH) || FAILURES_PATH}`);
  if (DRY_RUN) console.log("  ⚠ DRY RUN — no games were actually ingested");
  console.log("═══════════════════════════════════════════\n");

  if (!DRY_RUN) {
    await finishRun(sql, schedulerRun.id, {
      rows_scanned: processed,
      rows_created: created,
      rows_skipped: skipped,
      error_message: failed > 0 ? `${failed} title(s) failed to ingest` : null,
      metadata: {
        filePath: FILE_PATH,
        startAt: startIndex + 1,
        processed,
        created,
        skipped,
        failed,
        failuresFile: FAILURES_PATH,
      },
    });
  }
} catch (error) {
  caughtError = error;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Import failed: ${message}`);
  if (!DRY_RUN) {
    await finishRun(sql, schedulerRun.id, {
      error_message: message,
      metadata: {
        filePath: FILE_PATH,
        checkpoint: CHECKPOINT_PATH,
      },
    });
  }
} finally {
  if (!DRY_RUN && locked) {
    try {
      await releaseLock(sql, "import-games-from-file");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠ Cleanup warning while releasing lock: ${message}`);
    }
  }
  try {
    await sleep(25);
    await sql.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠ Cleanup warning while closing DB connection: ${message}`);
  }
}

if (caughtError) {
  process.exit(1);
}
