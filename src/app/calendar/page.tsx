"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { getCalendarGames } from "@/lib/api";
import GameCard from "@/components/GameCard";
import FadeInSection from "@/components/FadeInSection";
import SectionHeader from "@/components/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(now));

  // Build 12-month range (current month ± 5)
  const monthOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    for (let i = -3; i <= 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      opts.push({
        key: monthKey(d),
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: games, isLoading } = useQuery({
    queryKey: ["calendar", selectedMonth],
    queryFn: () => getCalendarGames(selectedMonth),
    staleTime: 5 * 60 * 1000,
  });

  // Group games by day
  const grouped = useMemo(() => {
    if (!games) return {};
    const map: Record<string, typeof games> = {};
    for (const g of games) {
      const day = g.releaseDate?.slice(0, 10) ?? "TBA";
      (map[day] ??= []).push(g);
    }
    // Sort keys
    return Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [games]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 page-enter">
      <FadeInSection>
        <SectionHeader
          title="Release Calendar"
          icon="📅"
          subtitle="Upcoming and recent game launches"
        />
      </FadeInSection>

      {/* Month picker */}
      <FadeInSection>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {monthOptions.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMonth(m.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                m.key === selectedMonth
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "bg-surface border border-white/[0.08] text-secondary hover:text-foreground hover:border-white/20"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </FadeInSection>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="aspect-[3/4] rounded-2xl" />
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
            className="space-y-8"
          >
            {Object.entries(grouped).map(([date, dayGames]) => {
              const formatted = date === "TBA"
                ? "TBA"
                : new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  });
              return (
                <FadeInSection key={date}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        {formatted}
                      </h3>
                      <span className="text-xs text-tertiary">
                        {dayGames.length} game{dayGames.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {dayGames.map((game) => (
                        <GameCard key={game.id} game={game} />
                      ))}
                    </div>
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
            className="text-center py-16 space-y-3"
          >
            <div className="text-5xl">📭</div>
            <p className="text-secondary text-sm">
              No releases found for this month.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
