import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Library",
  description:
    "Manage your game library — track what you're playing, completed, backlogged, and wishlisted.",
  robots: { index: false, follow: false },
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
