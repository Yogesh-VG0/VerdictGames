"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Home, Compass, Search, Gamepad2, User, type LucideIcon } from "lucide-react";
import { hasActiveNavHref, isNavHrefActive } from "@/lib/nav-active";
import { SHARED_NAV_DESTINATIONS, SHARED_NAV_LABELS } from "@/lib/shared-nav";
import { cn } from "@/lib/utils";

const subscribeClientReady = () => () => {};

type BottomNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type BottomNavUser = ReturnType<typeof useAuth>["user"];

function getLinks(user: BottomNavUser): BottomNavLink[] {
  return [
    { href: "/", label: "Home", icon: Home },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: SHARED_NAV_DESTINATIONS.browse, label: SHARED_NAV_LABELS.browse, icon: Search },
    ...(user
      ? [{ href: "/library", label: "Library", icon: Gamepad2 }]
      : [{ href: SHARED_NAV_DESTINATIONS.deals, label: SHARED_NAV_LABELS.deals, icon: Gamepad2 }]),
    {
      href: user ? `/profile/${user.username}` : "/about",
      label: user ? "Profile" : "More",
      icon: User,
    },
  ];
}

function BottomNavMarkup({
  links,
  visible,
  isLinkActive,
}: {
  links: BottomNavLink[];
  visible: boolean;
  isLinkActive: (href: string) => boolean;
}) {
  return (
    <nav
      aria-label="Bottom navigation"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/90 backdrop-blur-2xl border-t border-border safe-area-bottom transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="flex items-center justify-around h-14 px-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = isLinkActive(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200",
                isActive
                  ? "text-accent"
                  : "text-tertiary active:text-secondary"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-transform duration-200", isActive && "scale-110")} />
              <span className="text-[9px] font-medium">{link.label}</span>
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-accent rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BottomNavFallback() {
  const pathname = usePathname();
  const { user } = useAuth();
  const activeReady = useSyncExternalStore(subscribeClientReady, () => true, () => false);
  const links = getLinks(user);
  const queryHrefCandidates = links.filter((link) => link.href.startsWith(`${SHARED_NAV_DESTINATIONS.browse}?`)).map((link) => link.href);

  return (
    <BottomNavMarkup
      links={links}
      visible={true}
      isLinkActive={(href) => {
        if (!activeReady) {
          return false;
        }

        if (href === SHARED_NAV_DESTINATIONS.browse) {
          return isNavHrefActive(pathname, null, href, "exact")
            && !hasActiveNavHref(pathname, null, queryHrefCandidates);
        }

        return isNavHrefActive(pathname, null, href);
      }}
    />
  );
}

function BottomNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const activeReady = useSyncExternalStore(subscribeClientReady, () => true, () => false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Show when scrolling up or near top, hide when scrolling down
        if (y < 60) {
          setVisible(true);
        } else if (y < lastScrollY.current - 10) {
          setVisible(true);
        } else if (y > lastScrollY.current + 10) {
          setVisible(false);
        }
        lastScrollY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = getLinks(user);
  const queryHrefCandidates = links.filter((link) => link.href.startsWith(`${SHARED_NAV_DESTINATIONS.browse}?`)).map((link) => link.href);
  const hasExplicitSearchDestination = hasActiveNavHref(pathname, searchParams, queryHrefCandidates);

  const isLinkActive = (href: string) => {
    if (!activeReady) {
      return false;
    }

    if (href === SHARED_NAV_DESTINATIONS.browse) {
      return isNavHrefActive(pathname, searchParams, href, "exact") && !hasExplicitSearchDestination;
    }

    return isNavHrefActive(pathname, searchParams, href);
  };

  return <BottomNavMarkup links={links} visible={visible} isLinkActive={isLinkActive} />;
}

export default function BottomNav() {
  return (
    <Suspense fallback={<BottomNavFallback />}>
      <BottomNavContent />
    </Suspense>
  );
}
