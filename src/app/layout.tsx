import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import NavbarTop from "@/components/NavbarTop";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { serializeJsonLd } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";
const enableVercelObservability = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "verdict.games — The Verdict on Every Game",
    template: "%s | verdict.games",
  },
  description:
    "Your trusted source for honest game reviews across all platforms. Discover verdicts, curated lists, and a community that cares about gaming.",
  keywords: [
    "game reviews", "verdict games", "PC game reviews", "PlayStation reviews",
    "Xbox reviews", "Nintendo Switch reviews", "game ratings", "game verdicts",
    "honest game reviews", "gaming community", "Steam reviews", "game scores",
  ],
  /* Icons handled by Next.js file conventions:
     src/app/favicon.ico, src/app/icon.png, src/app/apple-icon.png */
  alternates: { canonical: SITE_URL },
  category: "gaming",
  openGraph: {
    title: "verdict.games",
    description: "Honest verdicts for games across all platforms.",
    siteName: "verdict.games",
    locale: "en_US",
    type: "website",
    url: SITE_URL,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "verdict.games — The Verdict on Every Game" }],
  },
  manifest: "/manifest.json",
  twitter: {
    card: "summary_large_image",
    title: "verdict.games",
    description: "Honest verdicts for games across all platforms.",
    images: [{ url: "/og-default.png", alt: "verdict.games" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "verdict.games",
    url: SITE_URL,
    description:
      "Your trusted source for honest game reviews across all platforms.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-accent"
        >
          Skip to main content
        </a>
        <Providers>
          <NavbarTop />
          <main id="main-content" tabIndex={-1} className="min-h-screen md:pb-0" style={{ paddingBottom: "var(--bottom-nav-height, 56px)" }}>{children}</main>
          <Footer />
          <ScrollToTop />
          <BottomNav />
        </Providers>
        {enableVercelObservability ? <Analytics /> : null}
        {enableVercelObservability ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
