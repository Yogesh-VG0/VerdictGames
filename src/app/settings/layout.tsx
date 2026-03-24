import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your verdict.games account settings, profile, and preferences.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
