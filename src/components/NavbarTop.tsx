"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function NavbarTop() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <>
      {/* ── Mobile header ── */}
      <header className="sticky top-0 z-50 md:hidden border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/" className="flex items-center gap-1 group">
            <span className="text-accent font-bold text-base tracking-tight">
              VERDICT
            </span>
            <span className="text-secondary text-base font-light">.games</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Desktop header ── */}
      <header className="sticky top-0 z-50 hidden md:block border-b border-border bg-background/80 backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-1.5 group">
            <span className="text-accent font-bold text-lg tracking-tight group-hover:text-accent-hover transition-colors">
              VERDICT
            </span>
            <span className="text-secondary text-lg font-light">.games</span>
          </Link>

          {/* Nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {[
              { href: "/", label: "Home" },
              { href: "/reviews", label: "Reviews" },
              { href: "/lists", label: "Lists" },
              { href: "/about", label: "About" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors rounded-sm"
              >
                {link.label}
              </Link>
            ))}
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
