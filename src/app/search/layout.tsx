import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Games",
  description: "Search and filter games by genre, platform, year, and more. Find your next favorite game with honest verdict scores.",
  openGraph: {
    title: "Search Games | verdict.games",
    description: "Search and filter games by genre, platform, year, and more.",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
