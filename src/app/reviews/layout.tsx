import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Read community reviews and honest verdicts for games across all platforms. Share your own opinions and help others find great games.",
  keywords: ["game reviews", "honest reviews", "community reviews", "Steam reviews", "game opinions", "verdict reviews"],
  alternates: { canonical: `${SITE_URL}/reviews` },
  openGraph: {
    title: "Reviews | verdict.games",
    description: "Community reviews and honest verdicts for games across all platforms.",
    url: `${SITE_URL}/reviews`,
  },
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
