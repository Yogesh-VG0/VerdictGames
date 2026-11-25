import type { Metadata } from "next";
import type { Game } from "@/lib/types";
import { hasKnownFullRelease } from "@/lib/utils/release-status";

export const SITE_URL = "https://www.verdict.games";
export const SITE_NAME = "Verdict Games";
export const HOME_TITLE = `${SITE_NAME} — Game Reviews, Ratings & Discovery`;
export const HOME_DESCRIPTION = "Discover the best video games with data-driven ratings, community reviews, trending games, upcoming releases, game comparisons and personalized recommendations.";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

interface SocialMetadataOptions {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article" | "profile";
  twitterCard?: "summary" | "summary_large_image" | "player" | "app";
  locale?: string;
}

export function buildSocialMetadata({
  title,
  description,
  url,
  image = DEFAULT_OG_IMAGE,
  imageAlt = title,
  type = "website",
  twitterCard = "summary_large_image",
  locale,
}: SocialMetadataOptions): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale,
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

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function getGameDatePublished(
  game: Pick<Game, "releaseStatus" | "isPreview" | "isProvisional" | "releaseTiming" | "releaseDate" | "releaseDateTba">,
  today = new Date().toISOString().slice(0, 10),
): string | undefined {
  if (game.isPreview || game.isProvisional || game.releaseDateTba
    || !hasKnownFullRelease({ release_status: game.releaseStatus })) return undefined;
  const day = game.releaseTiming
    ? game.releaseTiming.precision === "day" ? game.releaseTiming.value : undefined
    : game.releaseDate;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today) return undefined;
  const parsed = new Date(day);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day ? day : undefined;
}
