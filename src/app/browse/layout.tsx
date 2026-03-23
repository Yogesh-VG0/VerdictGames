import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Games",
  description: "Browse games by category — Trending, New Releases, Top Rated, Upcoming, and more. Filter by platform, genre, and year.",
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
