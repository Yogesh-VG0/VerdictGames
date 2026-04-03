import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "Compare Games";
const description = "Compare games side by side — scores, platforms, genres, reviews, and more. Find out which game is the better pick.";
const socialTitle = "Compare Games | verdict.games";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["compare games", "game comparison", "game vs game", "verdict scores", "side by side"],
  alternates: { canonical: `${SITE_URL}/compare` },
  ...buildSocialMetadata({
    title: socialTitle,
    description,
    url: `${SITE_URL}/compare`,
  }),
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
