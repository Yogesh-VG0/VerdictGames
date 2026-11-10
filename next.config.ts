import type { NextConfig } from "next";

const localConnectSrc = process.env.NODE_ENV === "development"
  ? " http://127.0.0.1:54321 ws://127.0.0.1:54321 http://localhost:54321 ws://localhost:54321"
  : "";

const productionConnectSrc = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? ` ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin} wss://${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host}`
  : "";
const evalSource = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : "";

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
          { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline'${evalSource} https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'${productionConnectSrc}${localConnectSrc} https://vitals.vercel-insights.com https://va.vercel-scripts.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; frame-ancestors 'none'; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self';` },
        ],
      },
    ];
  },
  images: {
    qualities: [75, 85],
    remotePatterns: [
      ...['images.igdb.com', 'media.rawg.io', 'res.cloudinary.com', 'cdn.akamai.steamstatic.com',
        'shared.akamai.steamstatic.com', 'shared.fastly.steamstatic.com', 'cdn.cloudflare.steamstatic.com',
        'steamcdn-a.akamaihd.net', 'avatars.akamai.steamstatic.com', 'avatars.githubusercontent.com',
        'lh3.googleusercontent.com', 'play-lh.googleusercontent.com', 'is1-ssl.mzstatic.com',
        'is2-ssl.mzstatic.com', 'is3-ssl.mzstatic.com', 'is4-ssl.mzstatic.com', 'is5-ssl.mzstatic.com',
      ].map(hostname => ({ protocol: 'https' as const, hostname, port: '' })),
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [{ protocol: 'https' as const,
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, port: '', pathname: '/storage/v1/object/public/**' }] : []),
    ],
    maximumRedirects: 0,
  },
};

export default nextConfig;
