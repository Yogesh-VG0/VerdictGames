import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Explore Games",
  description: "Discover the most anticipated, popular, and highest-rated games. Browse by year, genre, or all-time rankings powered by RAWG community data.",
  keywords: ["explore games", "most anticipated games", "best games of the year", "all-time top games", "game rankings", "browse by genre"],
  alternates: { canonical: `${SITE_URL}/explore` },
  openGraph: {
    title: "Explore Games | verdict.games",
    description: "Discover the most anticipated, popular, and highest-rated games.",
    url: `${SITE_URL}/explore`,
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
