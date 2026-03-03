import type { MetadataRoute } from "next";

const SITE_URL = process.env.SITE_URL || "https://www.verdict.games";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/profile/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
