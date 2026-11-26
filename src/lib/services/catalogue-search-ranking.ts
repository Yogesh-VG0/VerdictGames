import type { GameRow } from "@/lib/supabase/types";
import { dedupePublicCanonicalRows } from "@/lib/utils/publicCanonical";
import { confidenceWeightedScore } from "@/lib/utils/quality";

type Candidate = Parameters<typeof dedupePublicCanonicalRows>[0][number] &
  Pick<GameRow, "id" | "cover_image">;

function titleSimilarity(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();

  if (q === t) return 1;
  if (t.startsWith(q)) return 0.9 + Math.min(0.09, (q.length / t.length) * 0.09);
  if (q.startsWith(t)) return 0.85 + Math.min(0.09, (t.length / q.length) * 0.09);

  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);
  if (qWords.every(qw => tWords.some(tw => tw.includes(qw)))) {
    return 0.7 + Math.min(0.19, (qWords.length / Math.max(tWords.length, 1)) * 0.19);
  }
  if (t.includes(q)) return 0.5 + Math.min(0.19, (q.length / t.length) * 0.19);

  const matchingWords = qWords.filter(qw => tWords.some(tw => tw.includes(qw) || qw.includes(tw)));
  return matchingWords.length ? 0.1 + (matchingWords.length / qWords.length) * 0.3 : 0;
}

export function rankCatalogueMatches<T extends Candidate>(rows: T[], query: string, now = Date.now()): T[] {
  const scored = dedupePublicCanonicalRows(rows, { query, observedNow: now }).map(row => {
    const similarity = titleSimilarity(query, row.title);
    const quality = Math.min(1, confidenceWeightedScore(row) / 100);
    const volume = Math.min(1, Math.log10((row.review_count ?? 0) + 1) / 6);
    const ageDays = row.release_date ? (now - Date.parse(row.release_date)) / 86400000 : Infinity;
    const recency = ageDays < 365 ? 1 : ageDays < 730 ? 0.8 : ageDays < 1825 ? 0.6 : 0.3;
    const readiness = row.cover_image && row.title ? 0.05 : 0;
    return { row, relevance: similarity * 0.5 + quality * 0.25 + volume * 0.15 + recency * 0.1 + readiness };
  });
  scored.sort((left, right) => right.relevance - left.relevance || left.row.id.localeCompare(right.row.id));
  return scored.map(entry => entry.row);
}
