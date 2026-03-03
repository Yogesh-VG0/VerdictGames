/**
 * VERDICT.GAMES — Score Utilities (server-safe)
 *
 * Re-exports score logic for use in server-side services
 * without pulling in the full utils.ts (which uses Tailwind class names).
 */

import type { VerdictLabel } from "../types";

/** Map a 0–100 score to its verdict label. */
export function scoreToVerdict(score: number): VerdictLabel {
  if (score >= 90) return "MUST PLAY";
  if (score >= 75) return "WORTH IT";
  if (score >= 50) return "MIXED";
  return "SKIP";
}
