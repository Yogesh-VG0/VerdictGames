/**
 * VERDICT.GAMES — HowLongToBeat Client
 *
 * Fetches playtime estimates from HLTB's search API.
 * Returns main story, main+extras, and completionist times.
 */

interface HLTBResult {
  main: number | null;
  extras: number | null;
  completionist: number | null;
}

/**
 * Search HowLongToBeat for a game and return playtime estimates in hours.
 * Uses their public search endpoint.
 */
export async function fetchHLTBData(gameTitle: string): Promise<HLTBResult | null> {
  try {
    const res = await fetch("https://howlongtobeat.com/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "verdict.games/1.0",
        "Referer": "https://howlongtobeat.com",
      },
      body: JSON.stringify({
        searchType: "games",
        searchTerms: gameTitle.split(" "),
        searchPage: 1,
        size: 5,
        searchOptions: {
          games: {
            userId: 0,
            platform: "",
            sortCategory: "popular",
            rangeCategory: "main",
            rangeTime: { min: null, max: null },
            gameplay: { perspective: "", flow: "", genre: "" },
            rangeYear: { min: "", max: "" },
            modifier: "",
          },
          users: { sortCategory: "postcount" },
          filter: "",
          sort: 0,
          randomizer: 0,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const games = json?.data;

    if (!games || games.length === 0) return null;

    // Find best match by name similarity
    const normalized = gameTitle.toLowerCase().trim();
    const match = games.find(
      (g: Record<string, unknown>) =>
        (g.game_name as string)?.toLowerCase().trim() === normalized
    ) ?? games[0];

    // HLTB returns times in seconds or hours depending on version
    // The API returns hours directly in recent versions
    const main = match.comp_main ? Number(match.comp_main) / 3600 : null;
    const extras = match.comp_plus ? Number(match.comp_plus) / 3600 : null;
    const completionist = match.comp_100 ? Number(match.comp_100) / 3600 : null;

    return {
      main: main ? Math.round(main * 10) / 10 : null,
      extras: extras ? Math.round(extras * 10) / 10 : null,
      completionist: completionist ? Math.round(completionist * 10) / 10 : null,
    };
  } catch (err) {
    console.warn("[HLTB] Failed to fetch data for:", gameTitle, err);
    return null;
  }
}
