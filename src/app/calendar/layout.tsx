import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Release Calendar",
  description:
    "Upcoming game releases across all platforms. Stay updated on launch dates for PC, PlayStation 5, Xbox, Nintendo Switch, and more.",
  keywords: ["game release calendar", "upcoming games", "game launch dates", "new game releases"],
  alternates: { canonical: `${SITE_URL}/calendar` },
  openGraph: {
    title: "Release Calendar | verdict.games",
    description: "Upcoming game releases across all platforms.",
    url: `${SITE_URL}/calendar`,
  },
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
