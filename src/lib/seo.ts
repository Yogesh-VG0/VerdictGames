import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

interface SocialMetadataOptions {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article" | "profile";
  twitterCard?: "summary" | "summary_large_image" | "player" | "app";
}

export function buildSocialMetadata({
  title,
  description,
  url,
  image = DEFAULT_OG_IMAGE,
  imageAlt = title,
  type = "website",
  twitterCard = "summary_large_image",
}: SocialMetadataOptions): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: "verdict.games",
      type,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: twitterCard,
      title,
      description,
      images: [{ url: image, alt: imageAlt }],
    },
  };
}
