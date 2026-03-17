import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "media.rawg.io" },
      { protocol: "https", hostname: "cdn.akamai.steamstatic.com" },
      { protocol: "https", hostname: "steamcdn-a.akamaihd.net" },
      { protocol: "https", hostname: "store.steampowered.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "images.igdb.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "proxy.gxcorner.games" },
      { protocol: "https", hostname: "assets.news.gxcorner.games" },
      { protocol: "https", hostname: "play.gx.games" },
    ],
  },
};

export default nextConfig;
