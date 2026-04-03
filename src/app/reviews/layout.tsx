import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "Reviews";
const description = "Read community reviews and honest verdicts for games across all platforms. Share your own opinions and help others find great games.";
const socialTitle = "Reviews | verdict.games";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["game reviews", "honest reviews", "community reviews", "Steam reviews", "game opinions", "verdict reviews"],
  alternates: { canonical: `${SITE_URL}/reviews` },
  ...buildSocialMetadata({
    title: socialTitle,
    description,
    url: `${SITE_URL}/reviews`,
  }),
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
