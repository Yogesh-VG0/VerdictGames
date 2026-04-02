"use client";

import { Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Tag, Gift, Compass, Home } from "lucide-react";
import { isNavHrefActive } from "@/lib/nav-active";
import { SHARED_NAV_DESTINATIONS, SHARED_NAV_LABELS } from "@/lib/shared-nav";
import { cn } from "@/lib/utils";

const subscribeClientReady = () => () => {};

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: SHARED_NAV_DESTINATIONS.deals, label: SHARED_NAV_LABELS.deals, icon: Tag },
  { href: SHARED_NAV_DESTINATIONS.freeToPlay, label: SHARED_NAV_LABELS.freeToPlay, icon: Gift },
  { href: "/explore", label: "Explore", icon: Compass },
] as const;

function GXPageNavMarkup({ isLinkActive }: { isLinkActive: (href: string) => boolean }) {
  return (
    <nav aria-label="GX navigation" className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = isLinkActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
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

function GXPageNavFallback() {
  const pathname = usePathname();
  const activeReady = useSyncExternalStore(subscribeClientReady, () => true, () => false);

  return (
    <GXPageNavMarkup
      isLinkActive={(href) => activeReady ? isNavHrefActive(pathname, null, href) : false}
    />
  );
}

function GXPageNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeReady = useSyncExternalStore(subscribeClientReady, () => true, () => false);

  const isLinkActive = (href: string) => {
    if (!activeReady) {
      return false;
    }

    return isNavHrefActive(pathname, searchParams, href);
  };

  return <GXPageNavMarkup isLinkActive={isLinkActive} />;
}

export default function GXPageNav() {
  return (
    <Suspense fallback={<GXPageNavFallback />}>
      <GXPageNavContent />
    </Suspense>
  );
}
