"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect, useCallback, type KeyboardEvent as ReactKbEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Search, Flame, Sparkles, Trophy, CalendarDays,
  Star, List, Scale, Info, User, BookOpen, Settings,
  ShieldCheck, LogOut, ChevronDown, X, Menu,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import AuthModal from "./AuthModal";
import UserAvatar from "./UserAvatar";
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
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarCloseButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const signOutDialogRef = useRef<HTMLDivElement>(null);
  const signOutCancelButtonRef = useRef<HTMLButtonElement>(null);
  const lastSignOutTriggerRef = useRef<HTMLElement | null>(null);
  const mobileSearchWasOpen = useRef(false);
  const sidebarWasOpen = useRef(false);
  const signOutConfirmWasOpen = useRef(false);

  // Close dropdown on outside click
  useEffect(() => {
    if (!profileDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setProfileDropdownOpen(false);
        profileButtonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [profileDropdownOpen]);

  // Close dropdown on route change
  const closeDropdown = useCallback(() => setProfileDropdownOpen(false), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    closeDropdown();
  }, [pathname, closeDropdown]);

  const navLinks = [
    { href: "/", label: "Home", icon: <Home className="w-4 h-4" /> },
    { href: "/explore", label: "Explore", icon: <Sparkles className="w-4 h-4" /> },
    { href: "/search", label: "Browse", icon: <Flame className="w-4 h-4" /> },
    { href: "/calendar", label: "Calendar", icon: <CalendarDays className="w-4 h-4" /> },
    { href: "/reviews", label: "Reviews", icon: <Star className="w-4 h-4" /> },
    { href: "/lists", label: "Lists", icon: <List className="w-4 h-4" /> },
  ];

  const isNavLinkActive = useCallback((href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }, [pathname]);

  const getFocusableElements = useCallback((container: HTMLElement | null) => {
    if (!container) return [];

    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  const handleSignOut = useCallback((trigger?: HTMLElement | null) => {
    if (trigger && dropdownRef.current?.contains(trigger)) {
      lastSignOutTriggerRef.current = profileButtonRef.current;
      setProfileDropdownOpen(false);
    } else if (trigger && sidebarRef.current?.contains(trigger)) {
      lastSignOutTriggerRef.current = sidebarCloseButtonRef.current;
    } else {
      lastSignOutTriggerRef.current = trigger ?? null;
    }

    setSignOutConfirmOpen(true);
  }, []);

  const confirmSignOut = useCallback(async () => {
    await signOut();
    setSignOutConfirmOpen(false);
    setSidebarOpen(false);
    setProfileDropdownOpen(false);
  }, [signOut]);

  // Body scroll lock for sidebar
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (mobileSearchOpen) {
      mobileSearchInputRef.current?.focus();
    } else if (mobileSearchWasOpen.current) {
      mobileSearchButtonRef.current?.focus();
    }

    mobileSearchWasOpen.current = mobileSearchOpen;
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (sidebarOpen) {
      sidebarCloseButtonRef.current?.focus();
    } else if (sidebarWasOpen.current) {
      menuButtonRef.current?.focus();
    }

    sidebarWasOpen.current = sidebarOpen;
  }, [sidebarOpen]);

  useEffect(() => {
    if (profileDropdownOpen) {
      const [firstFocusable] = getFocusableElements(profileMenuRef.current);
      firstFocusable?.focus();
    }
  }, [getFocusableElements, profileDropdownOpen]);

  useEffect(() => {
    if (signOutConfirmOpen) {
      signOutCancelButtonRef.current?.focus();
    } else if (signOutConfirmWasOpen.current) {
      lastSignOutTriggerRef.current?.focus();
    }

    signOutConfirmWasOpen.current = signOutConfirmOpen;
  }, [signOutConfirmOpen]);

  // Focus trap helper
  const trapFocus = useCallback((e: ReactKbEvent<HTMLElement>, containerRef: React.RefObject<HTMLDivElement | null>) => {
    if (e.key === "Escape") return; // let escape handlers run
    if (e.key !== "Tab" || !containerRef.current) return;
    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [getFocusableElements]);

  const handleProfileButtonKeyDown = useCallback((e: ReactKbEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setProfileDropdownOpen(true);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setProfileDropdownOpen(false);
    }
  }, []);

  const handleProfileMenuKeyDown = useCallback((e: ReactKbEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setProfileDropdownOpen(false);
      profileButtonRef.current?.focus();
      return;
    }

    const focusable = getFocusableElements(profileMenuRef.current);
    if (focusable.length === 0) return;

    if (e.key === "Home") {
      e.preventDefault();
      focusable[0]?.focus();
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      focusable[focusable.length - 1]?.focus();
      return;
    }

    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

    e.preventDefault();
    const currentIndex = focusable.findIndex((element) => element === document.activeElement);
    const delta = e.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? delta === 1
          ? 0
          : focusable.length - 1
        : (currentIndex + delta + focusable.length) % focusable.length;

    focusable[nextIndex]?.focus();
  }, [getFocusableElements]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setMobileSearchOpen(false);
    }
  }


  return (
    <>
      {/* ── Mobile header ── */}
      <header className="sticky top-0 z-50 md:hidden bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" prefetch={false} className="flex items-center gap-2.5 group">
            <Image
              src="/VERDICT_LOGO_main.png"
              alt="Verdict Games"
              width={44}
              height={44}
              className="h-10 w-10 rounded-lg drop-shadow-lg"
              priority
            />
            <span className="font-bold text-lg tracking-tight text-foreground">
              Verdict<span className="text-accent">.games</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <motion.button
              ref={mobileSearchButtonRef}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileSearchOpen((open) => !open)}
              className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-secondary hover:text-foreground transition-colors"
              aria-controls="mobile-search-panel"
              aria-expanded={mobileSearchOpen}
              aria-label={mobileSearchOpen ? "Close search" : "Open search"}
            >
              <Search className="w-4 h-4" />
            </motion.button>
            <ThemeToggle />
            <motion.button
              ref={menuButtonRef}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setSidebarOpen((open) => !open)}
              className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-secondary hover:text-foreground transition-colors"
              aria-controls="mobile-navigation-drawer"
              aria-expanded={sidebarOpen}
              aria-haspopup="dialog"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              <Menu className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
        {/* Mobile search dropdown — click outside to close */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <>
              {/* Invisible backdrop to catch outside clicks */}
              <div className="fixed inset-0 z-[39]" onClick={() => setMobileSearchOpen(false)} />
              <motion.div
                id="mobile-search-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border relative z-[40]"
              >
                <form onSubmit={handleSearch} role="search" aria-label="Site search" className="px-4 py-3">
                  <input
                    id="mobile-site-search"
                    name="query"
                    ref={mobileSearchInputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setMobileSearchOpen(false);
                      }
                    }}
                    placeholder="Search games..."
                    aria-label="Search games"
                    className="w-full h-10 px-4 text-sm rounded-xl bg-surface-2 border border-border text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                  />
                </form>
              </motion.div>
            </>
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
              ref={sidebarRef}
              id="mobile-navigation-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-navigation-title"
              onKeyDown={(e) => {
                if (e.key === "Escape") setSidebarOpen(false);
                trapFocus(e, sidebarRef);
              }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[61] w-72 bg-background border-l border-border overflow-y-auto md:hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-border">
                <span id="mobile-navigation-title" className="font-bold text-foreground">Menu</span>
                <button
                  ref={sidebarCloseButtonRef}
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User section */}
              {user ? (
                <Link
                  href={`/profile/${user.username}`}
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className="block px-4 py-4 border-b border-border hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar src={user.avatar} displayName={user.displayName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{user.displayName}</p>
                      <p className="text-[11px] text-tertiary truncate">@{user.username}</p>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-tertiary -rotate-90 shrink-0" />
                  </div>
                </Link>
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
                {navLinks.map((link) => {
                  const isActive = isNavLinkActive(link.href);
                  return (
                    <Link
                      key={link.href + link.label}
                      href={link.href}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                        isActive
                          ? "text-accent bg-accent/5 font-medium"
                          : "text-secondary hover:text-foreground hover:bg-surface-2"
                      )}
                    >
                      <span className="w-5 flex justify-center opacity-70">{link.icon}</span>
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              {/* User-specific links */}
              {user && (
                <div className="py-2 border-t border-border">
                  <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-tertiary font-medium">Account</p>
                  <Link href={`/profile/${user.username}`} prefetch={false} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                    <User className="w-4 h-4 opacity-70" /> Profile
                  </Link>
                  <Link href="/library" prefetch={false} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                    <BookOpen className="w-4 h-4 opacity-70" /> Library
                  </Link>
                  <Link href="/settings" prefetch={false} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                    <Settings className="w-4 h-4 opacity-70" /> Settings
                  </Link>
                  {isAdminEmail(user.email) && (
                    <Link href="/admin" prefetch={false} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors">
                      <ShieldCheck className="w-4 h-4 opacity-70" /> Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleSignOut(e.currentTarget)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                  >
                    <LogOut className="w-4 h-4 opacity-70" /> Sign Out
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop navbar ── */}
      <header className="sticky top-0 z-50 hidden md:block bg-background/80 backdrop-blur-xl border-b border-border">
        <nav aria-label="Primary navigation" className="flex items-center gap-2 px-4 h-14 max-w-[1400px] mx-auto">
          {/* Logo */}
          <Link href="/" prefetch={false} className="shrink-0 flex items-center gap-3 pl-3 group">
            <Image
              src="/VERDICT_LOGO_main.png"
              alt="Verdict Games"
              width={48}
              height={48}
              className="h-10 w-10 rounded-lg drop-shadow-lg"
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
              const isActive = isNavLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-xl",
                    isActive
                      ? "text-foreground bg-accent/10"
                      : "text-secondary hover:text-foreground hover:bg-surface-2"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-accent/10 -z-10"
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
          <form onSubmit={handleSearch} role="search" aria-label="Site search" className="relative w-52">
            <input
              id="desktop-site-search"
              name="query"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games..."
              aria-label="Search games"
              className="w-full h-9 pl-9 pr-3 text-sm rounded-xl bg-surface-2 border border-border text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/40 focus:bg-elevated transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" />
          </form>

          {/* Profile / Auth + Theme toggle */}
          <div className="pr-2 flex items-center gap-2">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  id="desktop-profile-button"
                  ref={profileButtonRef}
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  onKeyDown={handleProfileButtonKeyDown}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-surface-2 transition-colors"
                  aria-haspopup="menu"
                  aria-controls="desktop-profile-menu"
                  aria-expanded={profileDropdownOpen}
                >
                  <UserAvatar src={user.avatar} displayName={user.displayName} size="sm" />
                  <span className="text-sm text-secondary max-w-[80px] truncate">{user.displayName}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-tertiary transition-transform duration-200", profileDropdownOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      id="desktop-profile-menu"
                      ref={profileMenuRef}
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      onKeyDown={handleProfileMenuKeyDown}
                      aria-labelledby="desktop-profile-button"
                      className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface border border-border shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                        <UserAvatar src={user.avatar} displayName={user.displayName} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{user.displayName}</p>
                          <p className="text-[11px] text-tertiary truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="py-1">
                        <Link
                          href={`/profile/${user.username}`}
                          prefetch={false}
                          onClick={closeDropdown}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                        >
                          <User className="w-4 h-4 opacity-60" />
                          Profile
                        </Link>
                        {isAdminEmail(user.email) && (
                          <Link
                            href="/admin"
                            prefetch={false}
                            onClick={closeDropdown}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4 opacity-60" />
                            Admin Dashboard
                          </Link>
                        )}
                        <Link
                          href="/library"
                          prefetch={false}
                          onClick={closeDropdown}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                        >
                          <BookOpen className="w-4 h-4 opacity-60" />
                          Library
                        </Link>
                        <Link
                          href="/settings"
                          prefetch={false}
                          onClick={closeDropdown}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                        >
                          <Settings className="w-4 h-4 opacity-60" />
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-border">
                        <button
                          type="button"
                          onClick={(e) => handleSignOut(e.currentTarget)}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                        >
                          <LogOut className="w-4 h-4 opacity-60" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
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

      {/* Sign Out Confirmation Dialog */}
      <AnimatePresence>
        {signOutConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
              onClick={() => setSignOutConfirmOpen(false)}
            />
            <motion.div
              ref={signOutDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="sign-out-dialog-title"
              aria-describedby="sign-out-dialog-description"
              onKeyDown={(e) => {
                if (e.key === "Escape") setSignOutConfirmOpen(false);
                trapFocus(e, signOutDialogRef);
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[71] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <LogOut className="w-8 h-8 text-danger mx-auto" />
                <h3 id="sign-out-dialog-title" className="text-lg font-bold text-foreground">Sign Out?</h3>
                <p id="sign-out-dialog-description" className="text-sm text-secondary">Are you sure you want to sign out of your account?</p>
              </div>
              <div className="flex gap-3">
                <button
                  ref={signOutCancelButtonRef}
                  type="button"
                  onClick={() => setSignOutConfirmOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-2 border border-border text-secondary hover:text-foreground hover:bg-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSignOut}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-danger text-white hover:bg-danger/90 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
