import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "About";
const description = "Learn about verdict.games — your trusted source for honest game verdicts across all platforms. Built by gamers, for gamers.";
const socialTitle = "About | verdict.games";

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
