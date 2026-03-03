"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { cn } from "@/lib/utils";

export default function NavbarTop() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setMobileSearchOpen(false);
    }
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/reviews", label: "Reviews" },
    { href: "/lists", label: "Lists" },
    { href: "/about", label: "About" },
  ];

  return (
    <>
      {/* ── Mobile header ── */}
      <header className="sticky top-0 z-50 md:hidden border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/" className="flex items-center gap-1.5 group">
            <Image src="/favicon.png" alt="V" width={24} height={24} className="rounded-sm" />
            <span className="text-accent font-bold text-base tracking-tight">
              VERDICT
            </span>
            <span className="text-secondary text-base font-light">.games</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="w-9 h-9 rounded-sm border border-border bg-surface-2 flex items-center justify-center text-secondary hover:text-foreground transition-colors"
              aria-label="Search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </motion.button>
            <ThemeToggle />
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
              <form onSubmit={handleSearch} className="px-4 py-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search games..."
                  className="w-full h-9 px-3 text-sm rounded-sm border border-border bg-surface-2 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors"
                  autoFocus
                />
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Desktop header ── */}
      <header className="sticky top-0 z-50 hidden md:block border-b border-border bg-background/80 backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2 group">
            <Image src="/favicon.png" alt="V" width={28} height={28} className="rounded-sm" />
            <span className="text-accent font-bold text-lg tracking-tight group-hover:text-accent-hover transition-colors">
              VERDICT
            </span>
            <span className="text-secondary text-lg font-light">.games</span>
          </Link>

          {/* Nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-3 py-1.5 text-sm transition-colors rounded-sm",
                    isActive
                      ? "text-accent font-medium"
                      : "text-secondary hover:text-foreground hover:bg-surface-2"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-1 right-1 h-0.5 bg-accent rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <form onSubmit={handleSearch} className="relative max-w-xs w-full">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-sm border border-border bg-surface-2 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary"
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
          <ThemeToggle />
        </nav>
      </header>
    </>
  );
}
