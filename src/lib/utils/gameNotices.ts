import type { Game } from "@/lib/types";

export interface GameNotice {
  id: string;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}

const COUNTER_STRIKE_2_SLUG = "/game/counter-strike-2-2";
const LEGACY_CSGO_APP_ID = 4465480;

export function getGameNotices(game: Pick<Game, "slug" | "steamAppId">): GameNotice[] {
  if (game.steamAppId === LEGACY_CSGO_APP_ID || game.slug === "counter-strike-global-offensive") {
    return [
      {
        id: "legacy-csgo",
        title: "Legacy Counter-Strike listing",
        body: "This page covers the legacy, unlisted Counter-Strike: Global Offensive listing. For the current live Counter-Strike experience, use Counter-Strike 2.",
        ctaHref: COUNTER_STRIKE_2_SLUG,
        ctaLabel: "View Counter-Strike 2",
      },
    ];
  }

  return [];
}
