import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Game Deals",
  description:
    "Find the best game deals and discounts across Steam, Epic, Humble Bundle, GOG, and more. Filter by genre and store, sorted by biggest savings — updated hourly.",
  keywords: [
    "game deals", "game discounts", "cheap games", "Steam deals", "Epic deals",
    "Humble Bundle deals", "GOG deals", "PC game sales", "best game prices",
    "game sale tracker",
  ],
  alternates: { canonical: `${SITE_URL}/deals` },
  openGraph: {
    title: "Game Deals | verdict.games",
    description: "The best game deals and discounts from across the web — updated hourly.",
    url: `${SITE_URL}/deals`,
  },
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
