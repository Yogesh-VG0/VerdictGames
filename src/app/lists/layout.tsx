import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Curated Lists",
  description: "Discover curated game lists — best co-op, top RPGs, hidden gems, and more. Hand-picked collections for every type of gamer.",
  openGraph: {
    title: "Curated Lists | verdict.games",
    description: "Hand-picked game collections for every type of gamer.",
  },
};

export default function ListsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
