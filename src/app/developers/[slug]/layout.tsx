import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  // Convert slug to readable name (e.g. "from-software" → "From Software")
  const name = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const pageUrl = `${SITE_URL}/developers/${slug}`;

  return {
    title: `${name} — Developer Hub`,
    description: `Browse all games by ${name}. See scores, reviews, genres, and platforms for every title from this developer.`,
    keywords: [name, "game developer", "developer games", "verdict scores"],
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${name} — Developer Hub | verdict.games`,
      description: `All games by ${name} with verdict scores and reviews.`,
      url: pageUrl,
      type: "profile",
      siteName: "verdict.games",
    },
    twitter: {
      card: "summary",
      title: `${name} — Developer Hub | verdict.games`,
      description: `All games by ${name} with verdict scores and reviews.`,
    },
  };
}

export default function DeveloperLayout({ children }: Props) {
  return children;
}
