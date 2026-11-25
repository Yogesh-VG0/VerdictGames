import type { Metadata } from "next";
import { buildSocialMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";

const title = "About";
const description = "Learn how Verdict Games helps players discover and compare games, how the Verdict Score works, and where game information and ratings come from.";
const socialTitle = `${title} | ${SITE_NAME}`;

export const metadata: Metadata = {
  title,
  description,
  keywords: ["about verdict.games", "game reviews", "gaming community", "honest verdicts"],
  alternates: { canonical: `${SITE_URL}/about` },
  ...buildSocialMetadata({
    title: socialTitle,
    description,
    url: `${SITE_URL}/about`,
  }),
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
