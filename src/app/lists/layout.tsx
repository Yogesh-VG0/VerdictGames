import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "Curated Lists";
const description = "Discover curated game lists — best co-op, top RPGs, hidden gems, and more. Hand-picked collections for every type of gamer.";
const socialTitle = "Curated Lists | verdict.games";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["curated game lists", "best game lists", "top RPGs", "hidden gems", "co-op games", "game collections"],
  alternates: { canonical: `${SITE_URL}/lists` },
  ...buildSocialMetadata({
    title: socialTitle,
    description,
    url: `${SITE_URL}/lists`,
  }),
};

export default function ListsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
