import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "Explore Games";
const description = "Discover the most anticipated, popular, and highest-rated games. Browse by year, genre, or all-time rankings powered by RAWG community data.";
const socialTitle = "Explore Games | verdict.games";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["explore games", "most anticipated games", "best games of the year", "all-time top games", "game rankings", "browse by genre"],
  alternates: { canonical: `${SITE_URL}/explore` },
  ...buildSocialMetadata({
    title: socialTitle,
    description,
    url: `${SITE_URL}/explore`,
  }),
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
