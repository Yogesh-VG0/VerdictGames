import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Games",
  description: "Discover the most anticipated, popular, and highest-rated games. Browse by year, genre, or all-time rankings powered by RAWG community data.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
