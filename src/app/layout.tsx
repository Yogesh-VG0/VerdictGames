import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import NavbarTop from "@/components/NavbarTop";
import BottomNav from "@/components/BottomNav";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games"),
  title: {
    default: "verdict.games — The Verdict on Every Game",
    template: "%s | verdict.games",
  },
  description:
    "Your trusted source for honest PC and Android game reviews. Discover verdicts, curated lists, and a community that cares about gaming.",
  icons: {
    icon: [
      { url: "/verdict_logo_dark.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/verdict_logo_dark.png",
    apple: { url: "/verdict_logo_dark.png", type: "image/png", sizes: "180x180" },
  },
  openGraph: {
    title: "verdict.games",
    description: "Honest verdicts for PC and Android games.",
    siteName: "verdict.games",
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  manifest: "/manifest.json",
  twitter: {
    card: "summary_large_image",
    title: "verdict.games",
    description: "Honest verdicts for PC and Android games.",
    images: ["/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <NavbarTop />
          <main className="min-h-screen pb-20 md:pb-0 md:pt-20 pt-0">{children}</main>
          <BottomNav />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
