import { VerdictLabel } from "./types";

/** Map a 0–100 score to its verdict label. */
export function scoreToVerdict(score: number): VerdictLabel {
  if (score >= 90) return "MUST PLAY";
  if (score >= 75) return "WORTH IT";
  if (score >= 50) return "MIXED";
  return "SKIP";
}

/** Return the Tailwind text-color class for a given score. */
export function scoreColor(score: number): string {
  if (score >= 90) return "text-score-great";
  if (score >= 75) return "text-score-good";
  if (score >= 50) return "text-score-mixed";
  return "text-score-bad";
}

/** Return the CSS variable color value for a score (for SVG strokes etc). */
export function scoreColorVar(score: number): string {
  if (score >= 90) return "var(--vg-score-great)";
  if (score >= 75) return "var(--vg-score-good)";
  if (score >= 50) return "var(--vg-score-mixed)";
  return "var(--vg-score-bad)";
}

/** Return a bg-color class for verdict badges. */
export function verdictBgClass(label: VerdictLabel): string {
  switch (label) {
    case "MUST PLAY":
      return "bg-score-great/20 text-score-great border-score-great/30";
    case "WORTH IT":
      return "bg-score-good/20 text-score-good border-score-good/30";
    case "MIXED":
      return "bg-score-mixed/20 text-score-mixed border-score-mixed/30";
    case "SKIP":
      return "bg-score-bad/20 text-score-bad border-score-bad/30";
  }
}

/** Format a date string to a readable format. Handles ISO dates, "YYYY-MM-DD", etc. */
export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === "null" || dateStr === "undefined") return "TBA";
  // Handle YYYY-MM-DD format (append T00:00:00 to avoid timezone issues)
  const normalized = dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Truncate text to a maximum length with ellipsis. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

/** Simple pluralize helper. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? singular + "s");
}

/** Generate a deterministic cover image URL from picsum using a seed. */
export function coverUrl(seed: string, w = 400, h = 560): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

/** Generate a screenshot URL. */
export function screenshotUrl(seed: string, index: number, w = 800, h = 450): string {
  return `https://picsum.photos/seed/${seed}-ss${index}/${w}/${h}`;
}

/** Generate an avatar URL. */
export function avatarUrl(seed: string, size = 128): string {
  return `https://picsum.photos/seed/${seed}-avatar/${size}/${size}`;
}

/** cn – simple className merge (no clsx dep needed). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
