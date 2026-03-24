import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Curated Lists",
  description: "Discover curated game lists — best co-op, top RPGs, hidden gems, and more. Hand-picked collections for every type of gamer.",
  keywords: ["curated game lists", "best game lists", "top RPGs", "hidden gems", "co-op games", "game collections"],
  alternates: { canonical: `${SITE_URL}/lists` },
  openGraph: {
    title: "Curated Lists | verdict.games",
    description: "Hand-picked game collections for every type of gamer.",
    url: `${SITE_URL}/lists`,
  },
};

export default function ListsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
