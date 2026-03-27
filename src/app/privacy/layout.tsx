import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for verdict.games — how we collect, use, and protect your data.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
