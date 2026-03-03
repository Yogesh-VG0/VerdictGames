/**
 * VERDICT.GAMES — Wikipedia REST API Integration
 *
 * Fetches short game summaries/descriptions from Wikipedia.
 * Uses the Wikimedia REST API — free, no key required.
 *
 * Docs: https://en.wikipedia.org/api/rest_v1/
 * Server-only — never import in client code.
 */

const WIKI_BASE = "https://en.wikipedia.org/api/rest_v1";

/* ───────── Response Types ───────── */

export interface WikiSummary {
  type: string;           // "standard", "disambiguation", etc.
  title: string;
  displaytitle: string;
  extract: string;        // plain text summary
  extract_html: string;   // HTML summary
  description: string;    // short Wikidata description
  content_urls: {
    desktop: { page: string; revisions: string; edit: string; talk: string };
    mobile: { page: string; revisions: string; edit: string; talk: string };
  };
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  originalimage?: {
    source: string;
    width: number;
    height: number;
  };
  lang: string;
  dir: string;
  timestamp: string;
}

/* ───────── API Functions ───────── */

/**
 * Get the Wikipedia summary for a page title.
 * Returns the extract (plain text) and page URL.
 */
export async function getWikiSummary(
  title: string
): Promise<WikiSummary | null> {
  try {
    // Wikipedia titles use underscores for spaces
    const encoded = encodeURIComponent(title.replace(/ /g, "_"));

    const res = await fetch(`${WIKI_BASE}/page/summary/${encoded}`, {
      headers: {
        "User-Agent": "VerdictGames/1.0 (https://verdict.games; contact@verdict.games)",
      },
      next: { revalidate: 86400 }, // cache 24h — Wikipedia doesn't change fast
    });

    if (!res.ok) return null;

    const data: WikiSummary = await res.json();

    // Skip disambiguation pages
    if (data.type === "disambiguation") return null;

    return data;
  } catch (err) {
    console.error(`[Wikipedia] Failed to fetch summary for "${title}":`, err);
    return null;
  }
}

/**
 * Search Wikipedia for a game page and return its summary.
 * Tries multiple title variants to find the right page.
 */
export async function findGameWikiSummary(
  gameTitle: string
): Promise<{
  excerpt: string;
  url: string;
} | null> {
  // Try title variants in order of specificity
  const variants = [
    `${gameTitle} (video game)`,
    gameTitle,
    `${gameTitle} (game)`,
  ];

  for (const variant of variants) {
    const summary = await getWikiSummary(variant);
    if (summary?.extract) {
      // Verify it's actually about a video game (basic heuristic)
      const text = summary.extract.toLowerCase();
      const gameIndicators = [
        "video game", "game", "developed", "published",
        "gameplay", "player", "release", "console", "playstation",
        "xbox", "nintendo", "steam", "pc game",
      ];

      const isGameRelated = gameIndicators.some((kw) => text.includes(kw));

      if (isGameRelated) {
        // Keep a generous excerpt; cut at sentence boundary near 1200 chars
        let excerpt = summary.extract;
        if (excerpt.length > 1200) {
          const cut = excerpt.substring(0, 1200);
          const lastPeriod = cut.lastIndexOf(".");
          excerpt = lastPeriod > 400 ? cut.substring(0, lastPeriod + 1) : cut.trimEnd() + "...";
        }

        return {
          excerpt,
          url: summary.content_urls.desktop.page,
        };
      }
    }
  }

  return null;
}
