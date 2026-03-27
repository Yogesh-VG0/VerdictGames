import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gaming News | Verdict Games",
  description:
    "The latest gaming news, trending stories and breaking updates from top gaming outlets — curated by Verdict Games.",
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
