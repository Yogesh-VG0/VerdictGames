import type { NextConfig } from "next";

function supabaseImageHosts(): { protocol: "https"; hostname: string }[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    return [{ protocol: "https", hostname: new URL(url).hostname }];
  } catch {
    return [];
  }
}

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
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images2.alphacoders.com" },
      { protocol: "https", hostname: "images3.alphacoders.com" },
      { protocol: "https", hostname: "images4.alphacoders.com" },
      { protocol: "https", hostname: "images5.alphacoders.com" },
      { protocol: "https", hostname: "images6.alphacoders.com" },
      { protocol: "https", hostname: "images7.alphacoders.com" },
      { protocol: "https", hostname: "images8.alphacoders.com" },
      ...supabaseImageHosts(),
    ],
  },
};

export default nextConfig;
