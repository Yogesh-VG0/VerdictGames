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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
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
      // Alphacoders wallpapers
      { protocol: "https", hostname: "images2.alphacoders.com" },
      { protocol: "https", hostname: "images3.alphacoders.com" },
      { protocol: "https", hostname: "images4.alphacoders.com" },
      { protocol: "https", hostname: "images5.alphacoders.com" },
      { protocol: "https", hostname: "images6.alphacoders.com" },
      { protocol: "https", hostname: "images7.alphacoders.com" },
      { protocol: "https", hostname: "images8.alphacoders.com" },
      // Admin-configured hero image sources
      { protocol: "https", hostname: "wallpapercave.com" },
      { protocol: "https", hostname: "gaming-cdn.com" },
      { protocol: "https", hostname: "i.redd.it" },
      { protocol: "https", hostname: "preview.redd.it" },
      { protocol: "https", hostname: "external-preview.redd.it" },
      { protocol: "https", hostname: "static1.srcdn.com" },
      { protocol: "https", hostname: "static0.gamerantimages.com" },
      { protocol: "https", hostname: "cdn.mos.cms.futurecdn.net" },
      { protocol: "https", hostname: "assetsio.gnwcdn.com" },
      { protocol: "https", hostname: "assets.xboxservices.com" },
      { protocol: "https", hostname: "shared.cloudflare.steamstatic.com" },
      { protocol: "https", hostname: "clan.cloudflare.steamstatic.com" },
      { protocol: "https", hostname: "cdna.artstation.com" },
      { protocol: "https", hostname: "cdnb.artstation.com" },
      ...supabaseImageHosts(),
    ],
  },
};

export default nextConfig;
