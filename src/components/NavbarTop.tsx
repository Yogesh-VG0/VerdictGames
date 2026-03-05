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
      <header className="sticky top-0 z-50 md:hidden bg-background/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center group">
            <Image
              src="/verdict_logo_light.png"
              alt="Verdict Games"
              width={132}
              height={48}
              className="h-9 w-auto dark:hidden"
              priority
            />
            <Image
              src="/verdict_logo_dark.png"
              alt="Verdict Games"
              width={132}
              height={48}
              className="hidden h-9 w-auto dark:block"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-secondary hover:text-foreground transition-colors"
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
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <form onSubmit={handleSearch} className="px-4 py-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search games..."
                  className="w-full h-10 px-4 text-sm rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                  autoFocus
                />
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Desktop floating navbar ── */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 hidden md:block w-[95%] max-w-5xl">
        <nav className="flex items-center gap-2 px-2 h-14 rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center pl-3 group">
            <Image
              src="/verdict_logo_light.png"
              alt="Verdict Games"
              width={150}
              height={52}
              className="h-10 w-auto dark:hidden"
              priority
            />
            <Image
              src="/verdict_logo_dark.png"
              alt="Verdict Games"
              width={150}
              height={52}
              className="hidden h-10 w-auto dark:block"
              priority
            />
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
          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Search */}
          <form onSubmit={handleSearch} className="relative w-52">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/40 focus:bg-white/10 transition-all"
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
          <div className="pr-2">
            <ThemeToggle />
          </div>
        </nav>
      </header>
    </>
  );
}
