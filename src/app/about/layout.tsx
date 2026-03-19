import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about verdict.games — your trusted source for honest game verdicts across all platforms. Built by gamers, for gamers.",
  keywords: ["about verdict.games", "game reviews", "gaming community", "honest verdicts"],
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "About | verdict.games",
    description: "Your trusted source for honest game verdicts across all platforms.",
    url: `${SITE_URL}/about`,
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
