import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "Game Deals";
const description = "Find the best game deals and discounts across Steam, Epic, Humble Bundle, GOG, and more. Filter by genre and store, sorted by biggest savings — updated hourly.";
const socialTitle = "Game Deals | verdict.games";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "game deals", "game discounts", "cheap games", "Steam deals", "Epic deals",
    "Humble Bundle deals", "GOG deals", "PC game sales", "best game prices",
    "game sale tracker",
  ],
  alternates: { canonical: `${SITE_URL}/deals` },
  ...buildSocialMetadata({
    title: socialTitle,
    description,
    url: `${SITE_URL}/deals`,
  }),
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
