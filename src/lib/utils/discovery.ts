import type { GameRow } from "@/lib/supabase/types";
import { normalizeTitle } from "@/lib/utils/slugify";

const PACKAGING_SUFFIX_PATTERNS = [
  /(?:\s*[-–:]\s*)?game of the year edition$/i,
  /(?:\s*[-–:]\s*)?goty edition$/i,
  /(?:\s*[-–:]\s*)?complete edition$/i,
  /(?:\s*[-–:]\s*)?ultimate edition$/i,
  /(?:\s*[-–:]\s*)?definitive edition$/i,
  /(?:\s*[-–:]\s*)?enhanced edition$/i,
  /(?:\s*[-–:]\s*)?digital deluxe edition$/i,
  /(?:\s*[-–:]\s*)?deluxe edition$/i,
  /(?:\s*[-–:]\s*)?director'?s cut$/i,
  /(?:\s*[-–:]\s*)?anniversary edition$/i,
];

const TITLE_YEAR_DISAMBIGUATION_PATTERN = /\s*\((?:19|20)\d{2}\)$/i;

const SUPPLEMENTAL_TITLE_PATTERNS = [
  /\bseason pass\b/i,
  /\bexpansion pass\b/i,
  /\bsoundtrack\b/i,
  /\bartbook\b/i,
  /\bstarter pack\b/i,
  /\bbonus content\b/i,
  /\bcosmetic pack\b/i,
];

const SUPPLEMENTAL_DESCRIPTION_PATTERNS = [
  /\byou must own the main game\b/i,
  /\bthis content requires\b/i,
  /\bdownloadable content\b/i,
  /\bexpansion pack\b/i,
  /\bincludes the following dlc\b/i,
  /\bdigital deluxe edition allows access\b/i,
  /\bbase game\s*\+\s*(digital deluxe|season pass|art book|soundtrack)\b/i,
  /\bdigital art book\b/i,
  /\bextra bgm pack\b/i,
  /\bseason pass\b/i,
  /\bsecond and final expansion\b/i,
  /\bmissing link in the main story\b/i,
  /\bbonuses will be given to those who purchase\b/i,
  /\bcontent can be downloaded from the store\b/i,
];

function stripPackagingSuffix(title: string): string {
  let stripped = title.trim();
  let changed = true;

  while (changed) {
    changed = false;
    for (const pattern of PACKAGING_SUFFIX_PATTERNS) {
      const next = stripped.replace(pattern, "").trim();
      if (next !== stripped) {
        stripped = next;
        changed = true;
      }
    }
  }

  return stripped;
}

function stripTitleDisambiguationYear(title: string): string {
  return title.replace(TITLE_YEAR_DISAMBIGUATION_PATTERN, "").trim();
}

export function isPackagingEditionTitle(title: string): boolean {
  return PACKAGING_SUFFIX_PATTERNS.some((pattern) => pattern.test(title));
}

export function hasTitleDisambiguationYearSuffix(title: string): boolean {
  return TITLE_YEAR_DISAMBIGUATION_PATTERN.test(title);
}

export function getDiscoveryCanonicalTitle(title: string): string {
  return normalizeTitle(stripTitleDisambiguationYear(stripPackagingSuffix(title)));
}

export function hasSupplementalDescription(description?: string | null): boolean {
  if (!description) {
    return false;
  }

  return SUPPLEMENTAL_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description));
}

export function isPrimaryDiscoveryGame(row: Pick<GameRow, "title" | "description">): boolean {
  if (isPackagingEditionTitle(row.title)) {
    return false;
  }

  if (SUPPLEMENTAL_TITLE_PATTERNS.some((pattern) => pattern.test(row.title))) {
    return false;
  }

  return !hasSupplementalDescription(row.description);
}

export function sanitizeDiscoveryDescription(
  row: Pick<GameRow, "description" | "wikipedia_excerpt">
): string {
  if (!hasSupplementalDescription(row.description)) {
    return row.description ?? "";
  }

  return row.wikipedia_excerpt?.trim() || "";
}
