import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const pageUrl = `${SITE_URL}/profile/${username}`;

  return {
    title: `${username}'s Profile`,
    description: `View ${username}'s game library, reviews, and activity on verdict.games.`,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${username}'s Profile | verdict.games`,
      description: `${username}'s game library, reviews, and activity.`,
      url: pageUrl,
      type: "profile",
      siteName: "verdict.games",
    },
  };
}

export default function ProfileLayout({ children }: Props) {
  return children;
}
