import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Search Games",
  description: "Search and filter games by genre, platform, year, and more. Find your next favorite game with honest verdict scores.",
  keywords: ["search games", "game reviews", "game filter", "verdict scores", "game discovery"],
  alternates: { canonical: `${SITE_URL}/search` },
  openGraph: {
    title: "Search Games | verdict.games",
    description: "Search and filter games by genre, platform, year, and more.",
    url: `${SITE_URL}/search`,
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}

