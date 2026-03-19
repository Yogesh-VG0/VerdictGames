"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import AuthModal from "./AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { isAdminEmail } from "@/lib/adminEmails";

export default function NavbarTop() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const allNavLinks = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/search", label: "Explore", icon: "🔍" },
    { href: "/search?sort=trending", label: "Trending", icon: "🔥" },
    { href: "/search?sort=newest", label: "New Releases", icon: "✨" },
    { href: "/search?sort=top-rated", label: "Top Rated", icon: "🏆" },
    { href: "/calendar", label: "Calendar", icon: "📅" },
    { href: "/reviews", label: "Reviews", icon: "⭐" },
    { href: "/lists", label: "Lists", icon: "📋" },
    { href: "/compare", label: "Compare", icon: "⚖️" },
    { href: "/about", label: "About", icon: "ℹ️" },
  ];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setMobileSearchOpen(false);
    }
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/search", label: "Explore" },
    { href: "/reviews", label: "Reviews" },
    { href: "/calendar", label: "Calendar" },
    { href: "/lists", label: "Lists" },
  ];

  return (
    <>
      {/* ── Mobile header ── */}
      <header className="sticky top-0 z-50 md:hidden bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/verdict_logo.png"
              alt="Verdict Games"
              width={40}
              height={40}
              className="h-9 w-9 rounded-lg drop-shadow-lg"
              priority
            />
            <span className="font-bold text-lg tracking-tight text-foreground">
              Verdict<span className="text-accent">.games</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-secondary hover:text-foreground transition-colors"
              aria-label="Search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </motion.button>
            <ThemeToggle />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-secondary hover:text-foreground transition-colors"
              aria-label="Menu"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </motion.button>
          </div>
        </div>
        {/* Mobile search dropdown */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border"
            >
              <form onSubmit={handleSearch} className="px-4 py-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search games..."
                  className="w-full h-10 px-4 text-sm rounded-xl bg-surface-2 border border-border text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                  autoFocus
                />
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Mobile Sidebar Drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[61] w-72 bg-background border-l border-border overflow-y-auto md:hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-border">
                <span className="font-bold text-foreground">Menu</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User section */}
              {user ? (
                <div className="px-4 py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold">
                      {user.displayName?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{user.displayName}</p>
                      <p className="text-[11px] text-tertiary truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4 border-b border-border">
                  <button
                    onClick={() => { setSidebarOpen(false); setAuthModalOpen(true); }}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Navigation links */}
              <div className="py-2">
                <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-tertiary font-medium">Browse</p>
                {allNavLinks.map((link) => {
                  const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href.split("?")[0]);
                  return (
                    <Link
                      key={link.href + link.label}
                      href={link.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                        isActive
                          ? "text-accent bg-accent/5 font-medium"
                          : "text-secondary hover:text-foreground hover:bg-surface-2"
                      )}
                    >
                      <span className="text-base w-6 text-center">{link.icon}</span>
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              {/* User-specific links */}
              {user && (
                <div className="py-2 border-t border-border">
                  <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-tertiary font-medium">Account</p>
                  <Link href={`/profile/${user.username}`} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                    <span className="text-base w-6 text-center">👤</span> Profile
                  </Link>
                  <Link href="/library" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                    <span className="text-base w-6 text-center">📚</span> Library
                  </Link>
                  <Link href="/settings" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                    <span className="text-base w-6 text-center">⚙️</span> Settings
                  </Link>
                  {isAdminEmail(user.email) && (
                    <Link href="/admin" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                      <span className="text-base w-6 text-center">🛡️</span> Admin
                    </Link>
                  )}
                  <button
                    onClick={() => { signOut(); setSidebarOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                  >
                    <span className="text-base w-6 text-center">🚪</span> Sign Out
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop navbar ── */}
      <header className="sticky top-0 z-50 hidden md:block bg-background/80 backdrop-blur-xl border-b border-border">
        <nav className="flex items-center gap-2 px-4 h-14 max-w-7xl mx-auto">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-3 pl-3 group">
            <Image
              src="/verdict_logo.png"
              alt="Verdict Games"
              width={44}
              height={44}
              className="h-9 w-9 rounded-lg drop-shadow-lg"
              priority
            />
            <span className="font-bold text-lg tracking-tight text-foreground">
              Verdict<span className="text-accent">.games</span>
            </span>
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-xl",
                    isActive
                      ? "text-foreground bg-white/10"
                      : "text-secondary hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-white/10 -z-10"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Search */}
          <form onSubmit={handleSearch} className="relative w-52">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-xl bg-surface-2 border border-border text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/40 focus:bg-elevated transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </form>

          {/* Theme toggle */}
          <div className="pr-2 flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-surface-2 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold">
                    {user.displayName?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <span className="text-sm text-secondary max-w-[80px] truncate">{user.displayName}</span>
                </button>
                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-surface border border-border shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold text-foreground truncate">{user.displayName}</p>
                        <p className="text-[11px] text-tertiary truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          href={`/profile/${user.username}`}
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                        >
                          <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                          Profile
                        </Link>
                        {isAdminEmail(user.email) && (
                          <Link
                            href="/admin"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                          >
                            <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Admin Dashboard
                          </Link>
                        )}
                        <Link
                          href="/library"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                        >
                          <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                          Library
                        </Link>
                        <Link
                          href="/settings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                        >
                          <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-border">
                        <button
                          onClick={() => { signOut(); setProfileDropdownOpen(false); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                        >
                          <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
              >
                Sign In
              </button>
            )}
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
