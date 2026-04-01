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
    case "JUST RELEASED":
      return "bg-pixel-cyan/20 text-pixel-cyan border-pixel-cyan/30";
    default:
      return "bg-surface-2 text-secondary border-border";
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Format a date string to a readable format. Handles ISO dates, "YYYY-MM-DD", etc. */
export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === "null" || dateStr === "undefined") return "TBA";
  // Handle YYYY-MM-DD format (append T00:00:00 to avoid timezone issues)
  const normalized = dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "TBA";
  return dateFormatter.format(d);
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

/** Format cents to a dollar string like "$29.99". */
export function formatPrice(cents: number | undefined, currency = "USD"): string | null {
  if (cents === undefined || cents === null) return null;
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return numberFormatter.format(value);
}

export function getStableYear(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr === "null" || dateStr === "undefined") return null;
  const yearMatch = dateStr.match(/^(\d{4})/);
  if (yearMatch) return yearMatch[1];
  const normalized = dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return String(parsed.getUTCFullYear());
}

export function isFutureDate(dateStr: string | null | undefined, now = new Date()): boolean {
  if (!dateStr || dateStr === "null" || dateStr === "undefined") return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr > now.toISOString().slice(0, 10);
  }
  const normalized = dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() > now.getTime();
}

/** CSS glow class for score tier. */
export function scoreGlowClass(score: number): string {
  if (score >= 80) return "score-glow-great";
  if (score >= 65) return "score-glow-good";
  if (score >= 45) return "score-glow-mixed";
  return "score-glow-bad";
}

/** Human-readable label for score source. */
export function sourceLabel(source?: string): string | null {
  if (!source || source === "blended") return null;
  if (source === "steam") return "Steam";
  if (source === "igdb") return "IGDB";
  if (source === "metacritic") return "Critic";
  if (source === "rawg") return "RAWG";
  return null;
}

/** Format a timestamp to "Xh ago" / "Xm ago" / "Xd ago". */
export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
