"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tag, Gift, Compass, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search?tab=deals", label: "Deals", icon: Tag },
  { href: "/search?tab=free", label: "Free to Play", icon: Gift },
  { href: "/explore", label: "Explore", icon: Compass },
] as const;

export default function GXPageNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border",
              active
                ? "bg-accent/15 text-accent border-accent/30"
                : "bg-surface-2/50 text-secondary border-transparent hover:text-foreground hover:bg-surface-2 hover:border-border"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
