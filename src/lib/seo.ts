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

function resolveDateValue(value: string | undefined): Date | null {
  if (!value) return null;

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;

  return new Date(parsed);
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function resolveStaticPageLastModified(): Date {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (sourceDateEpoch && /^\d+$/.test(sourceDateEpoch)) {
    return new Date(Number(sourceDateEpoch) * 1000);
  }

  return (
    resolveDateValue(process.env.VERDICT_SITEMAP_LASTMOD)
    ?? resolveDateValue(process.env.SITEMAP_LASTMOD)
    ?? resolveDateValue(process.env.NEXT_PUBLIC_BUILD_TIME)
    ?? resolveDateValue(process.env.BUILD_TIME)
    ?? new Date()
  );
}
