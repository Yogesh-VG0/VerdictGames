import type { Metadata } from "next";
import { buildSocialMetadata, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const pageUrl = `${SITE_URL}/profile/${username}`;
  const title = `${username}'s Profile`;
  const description = `View ${username}'s game library, reviews, and activity on verdict.games.`;
  const socialTitle = `${username}'s Profile | verdict.games`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    ...buildSocialMetadata({
      title: socialTitle,
      description,
      url: pageUrl,
      type: "profile",
    }),
  };
}

export default function ProfileLayout({ children }: Props) {
  return children;
}
