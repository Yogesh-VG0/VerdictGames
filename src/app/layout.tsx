import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import NavbarTop from "@/components/NavbarTop";
import BottomNav from "@/components/BottomNav";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "verdict.games — The Verdict on Every Game",
    template: "%s | verdict.games",
  },
  description:
    "Your trusted source for honest PC and Android game reviews. Discover verdicts, curated lists, and a community that cares about gaming.",
  openGraph: {
    title: "verdict.games",
    description: "Honest verdicts for PC and Android games.",
    siteName: "verdict.games",
    type: "website",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <NavbarTop />
          <main className="min-h-screen pb-20 md:pb-0 pt-0">{children}</main>
          <BottomNav />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
