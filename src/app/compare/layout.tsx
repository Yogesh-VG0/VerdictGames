import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Compare Games",
  description:
    "Compare games side by side — scores, platforms, genres, reviews, and more. Find out which game is the better pick.",
  keywords: ["compare games", "game comparison", "game vs game", "verdict scores", "side by side"],
  alternates: { canonical: `${SITE_URL}/compare` },
  openGraph: {
    title: "Compare Games | verdict.games",
    description: "Compare games side by side — scores, platforms, genres, and more.",
    url: `${SITE_URL}/compare`,
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
