import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for verdict.games — rules and guidelines for using our platform.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
