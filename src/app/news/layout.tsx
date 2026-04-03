import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

const title = "Gaming News";
const description = "The latest gaming news, trending stories and breaking updates from top gaming outlets — curated by Verdict Games.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/news` },
  ...buildSocialMetadata({
    title,
    description,
    url: `${SITE_URL}/news`,
  }),
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
