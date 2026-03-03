import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Read community reviews and honest verdicts for PC & Android games. Share your own opinions and help others find great games.",
  openGraph: {
    title: "Reviews | verdict.games",
    description: "Community reviews and honest verdicts for PC & Android games.",
  },
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
