import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "Free to Play Games";
const description = "Discover the best free-to-play games and titles available on Xbox Game Pass and PlayStation Plus. Browse by genre and platform — updated hourly.";
const socialTitle = "Free to Play Games | verdict.games";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "free to play games", "free games", "F2P games", "Game Pass games",
    "PS Plus games", "PlayStation Plus catalog", "Xbox Game Pass catalog",
    "best free games", "free PC games",
  ],
  alternates: { canonical: `${SITE_URL}/free-to-play` },
  ...buildSocialMetadata({
    title: socialTitle,
    description,
    url: `${SITE_URL}/free-to-play`,
  }),
};

export default function FreeToPlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
