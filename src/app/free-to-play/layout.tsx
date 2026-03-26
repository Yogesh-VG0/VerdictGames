import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Free to Play Games",
  description:
    "Discover the best free-to-play games and titles available on Xbox Game Pass and PlayStation Plus. Browse by genre and platform — updated hourly.",
  keywords: [
    "free to play games", "free games", "F2P games", "Game Pass games",
    "PS Plus games", "PlayStation Plus catalog", "Xbox Game Pass catalog",
    "best free games", "free PC games",
  ],
  alternates: { canonical: `${SITE_URL}/free-to-play` },
  openGraph: {
    title: "Free to Play Games | verdict.games",
    description: "The best free-to-play games and subscription catalog picks — updated hourly.",
    url: `${SITE_URL}/free-to-play`,
  },
};

export default function FreeToPlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
