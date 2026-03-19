import { VerdictLabel } from "./types";

/** Re-export from utils/score.ts — single source of truth */
export { scoreToVerdict } from "./utils/score";

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
    case "COMING SOON":
      return "bg-accent/20 text-accent border-accent/30";
    default:
      return "bg-surface-2 text-secondary border-border";
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

/** cn – simple className merge (no clsx dep needed). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Short platform label for badges. */
export function platformShort(platform: string): string {
  const map: Record<string, string> = {
    "PC": "PC",
    "PlayStation 5": "PS5",
    "PlayStation 4": "PS4",
    "Xbox Series X|S": "XSX",
    "Xbox One": "XB1",
    "Nintendo Switch": "NSW",
    "Nintendo Switch 2": "NS2",
    "Android": "AND",
    "iOS": "iOS",
    "macOS": "Mac",
    "Linux": "LNX",
  };
  return map[platform] ?? platform;
}

/** Badge color variant for platforms. */
export function platformVariant(platform: string): "accent" | "success" | "warning" | "muted" | "default" {
  if (platform === "PC" || platform === "macOS" || platform === "Linux") return "accent";
  if (platform.startsWith("PlayStation")) return "default";
  if (platform.startsWith("Xbox")) return "success";
  if (platform.startsWith("Nintendo")) return "warning";
  if (platform === "Android" || platform === "iOS") return "muted";
  return "default";
}
