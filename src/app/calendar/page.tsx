"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { getCalendarGames, getGXCalendar, gxCalendarToGame } from "@/lib/api";
import FadeInSection from "@/components/FadeInSection";
import SectionHeader from "@/components/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { platformShort } from "@/lib/utils";
import type { Game, Platform } from "@/lib/types";
import type { GXCalendarGame } from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/* ── Platform icons (SVG inline for crisp rendering) ── */
const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  "PC":                 { icon: "🖥️", color: "text-pixel-cyan" },
  "PlayStation 5":      { icon: "🎮", color: "text-blue-400" },
  "PlayStation 4":      { icon: "🎮", color: "text-blue-300" },
  "Xbox Series X|S":    { icon: "🟢", color: "text-green-400" },
  "Xbox One":           { icon: "🟢", color: "text-green-300" },
  "Nintendo Switch":    { icon: "🔴", color: "text-red-400" },
  "Nintendo Switch 2":  { icon: "🔴", color: "text-red-300" },
  "Android":            { icon: "🤖", color: "text-green-400" },
  "iOS":                { icon: "🍎", color: "text-gray-300" },
  "macOS":              { icon: "🍎", color: "text-gray-400" },
  "Linux":              { icon: "🐧", color: "text-yellow-400" },
};

const PLATFORM_FILTERS: { label: string; value: Platform | "All"; icon: string }[] = [
  { label: "All", value: "All", icon: "🌐" },
  { label: "PC", value: "PC", icon: "🖥️" },
  { label: "PS5", value: "PlayStation 5", icon: "🎮" },
  { label: "Xbox", value: "Xbox Series X|S", icon: "🟢" },
  { label: "Switch", value: "Nintendo Switch", icon: "🔴" },
  { label: "Mobile", value: "Android", icon: "📱" },
];

export default function CalendarPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(now));
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "All">("All");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const monthNavRef = useRef<HTMLDivElement>(null);

  // Build 12-month range
  const monthOptions = useMemo(() => {
    const opts: { key: string; label: string; shortLabel: string }[] = [];
    for (let i = -3; i <= 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      opts.push({
        key: monthKey(d),
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        shortLabel: `${MONTHS[d.getMonth()].slice(0, 3)} '${String(d.getFullYear()).slice(2)}`,
      });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll selected month into view
  useEffect(() => {
    if (monthNavRef.current) {
      const active = monthNavRef.current.querySelector("[data-active=true]");
      if (active) active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedMonth]);

  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ["calendar", "gx", selectedMonth, selectedPlatform],
    queryFn: async () => {
      const gx = await getGXCalendar();
      const gxGames = (gx ?? [])
        .filter((g: GXCalendarGame) => (g.releaseDate ?? "").slice(0, 7) === selectedMonth)
        .map((g: GXCalendarGame) => gxCalendarToGame(g))
        .filter((g: Game) => selectedPlatform === "All" ? true : g.platforms.includes(selectedPlatform));

      if (gxGames.length > 0) return gxGames;
      const db = await getCalendarGames(selectedMonth);
      return (db ?? []).filter((g: Game) => selectedPlatform === "All" ? true : g.platforms.includes(selectedPlatform));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Group by day
  const grouped = useMemo(() => {
    if (!games) return {};
    const map: Record<string, Game[]> = {};
    for (const g of games) {
      const day = g.releaseDate?.slice(0, 10) ?? "TBA";
      (map[day] ??= []).push(g);
    }
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  }, [games]);

  const totalGames = games?.length ?? 0;

  const toggleDay = (day: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6 page-enter">
      {/* Header */}
      <FadeInSection>
        <SectionHeader
          title="Release Calendar"
          icon="📅"
          subtitle="Upcoming and recent game launches"
        />
      </FadeInSection>

      {/* ── Sticky Month Nav ── */}
      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border">
        <div ref={monthNavRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {monthOptions.map((m) => {
            const isCurrent = m.key === monthKey(now);
            return (
              <button
                key={m.key}
                data-active={m.key === selectedMonth}
                onClick={() => { setSelectedMonth(m.key); setCollapsedDays(new Set()); }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all relative ${
                  m.key === selectedMonth
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : isCurrent
                    ? "bg-accent/10 border border-accent/30 text-accent"
                    : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
                }`}
              >
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.shortLabel}</span>
                {isCurrent && m.key !== selectedMonth && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>

        {/* Platform filter row */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hide">
          {PLATFORM_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setSelectedPlatform(t.value)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                t.value === selectedPlatform
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-surface-2 text-tertiary border border-transparent hover:text-secondary hover:border-border"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
          {!isLoading && (
            <span className="shrink-0 self-center text-[10px] text-tertiary ml-auto pl-2">
              {totalGames} game{totalGames !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-16 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : games && games.length > 0 ? (
          <motion.div
            key={selectedMonth}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {Object.entries(grouped).map(([date, dayGames]) => {
              const formatted = date === "TBA"
                ? "TBA"
                : new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  });
              const isCollapsed = collapsedDays.has(date);
              const isToday = date === now.toISOString().slice(0, 10);

              return (
                <FadeInSection key={date}>
                  <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                    {/* Day header — collapsible */}
                    <button
                      onClick={() => toggleDay(date)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isToday ? "bg-accent animate-pulse" : "bg-tertiary"}`} />
                      <h3 className="text-sm font-bold text-foreground flex-1">
                        {formatted}
                        {isToday && <span className="ml-2 text-[10px] text-accent font-medium uppercase">Today</span>}
                      </h3>
                      <span className="text-xs text-tertiary tabular-nums">
                        {dayGames.length} game{dayGames.length !== 1 ? "s" : ""}
                      </span>
                      <motion.span
                        animate={{ rotate: isCollapsed ? -90 : 0 }}
                        className="text-tertiary text-sm"
                      >
                        ▼
                      </motion.span>
                    </button>

                    {/* Compact game cards */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="divide-y divide-border/50">
                            {dayGames.map((game) => (
                              <Link
                                key={game.id}
                                href={`/game/${game.slug}`}
                                className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                              >
                                {/* Cover thumbnail */}
                                <div className="relative w-12 h-16 sm:w-14 sm:h-[74px] shrink-0 rounded-lg overflow-hidden bg-surface-2">
                                  {game.coverImage ? (
                                    <Image
                                      src={game.coverImage}
                                      alt={game.title}
                                      fill
                                      className="object-cover"
                                      sizes="56px"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-lg text-tertiary">
                                      🎮
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <h4 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                                    {game.title}
                                  </h4>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Platform icons */}
                                    <div className="flex items-center gap-1">
                                      {game.platforms.slice(0, 4).map((p) => {
                                        const pi = PLATFORM_ICONS[p];
                                        return (
                                          <span
                                            key={p}
                                            title={p}
                                            className={`text-[10px] ${pi?.color ?? "text-tertiary"}`}
                                          >
                                            {pi?.icon ?? platformShort(p)}
                                          </span>
                                        );
                                      })}
                                      {game.platforms.length > 4 && (
                                        <span className="text-[9px] text-tertiary">+{game.platforms.length - 4}</span>
                                      )}
                                    </div>
                                    {/* Genres */}
                                    {game.genres.slice(0, 2).map(g => (
                                      <span key={g} className="text-[10px] text-tertiary bg-surface-2 px-1.5 py-0.5 rounded">
                                        {g}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* Score / Status */}
                                <div className="shrink-0 text-right">
                                  {game.isProvisional || game.verdictLabel === "COMING SOON" ? (
                                    <span className="text-[10px] text-accent font-medium bg-accent/10 px-2 py-1 rounded-lg">
                                      Coming Soon
                                    </span>
                                  ) : game.score > 0 ? (
                                    <div className="text-center">
                                      <p className={`text-lg font-bold tabular-nums ${
                                        game.score >= 80 ? "text-score-great" :
                                        game.score >= 65 ? "text-score-good" :
                                        game.score >= 45 ? "text-score-mixed" : "text-score-bad"
                                      }`}>
                                        {game.score}
                                      </p>
                                      <p className="text-[8px] text-tertiary uppercase">Verdict</p>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-tertiary">Awaiting</span>
                                  )}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </FadeInSection>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 space-y-4"
          >
            <div className="text-5xl">📭</div>
            <p className="text-foreground font-semibold text-lg">No releases found for this month</p>
            <p className="text-secondary text-sm max-w-md mx-auto">
              Try selecting a different month, or browse games that are already available.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
