"use client";

import { useState, useMemo, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";
import SectionHeader from "@/components/SectionHeader";
import PlatformIcon, {
  PLATFORM_FILTER_OPTIONS,
  getFilterPlatforms,
} from "@/components/ui/PlatformIcon";
import { collapsePlatforms } from "@/lib/utils/platform";
import { buildCalendarMonthOptions, buildCalendarPagePath, getCalendarMonthKey } from "@/lib/utils/gx-calendar";
import type { CalendarMonthResponse, Game, Platform } from "@/lib/types";
import { CalendarDays, Gamepad2, CalendarX } from "lucide-react";

interface CalendarClientPageProps {
  initialMonth: string;
  initialMonthData: CalendarMonthResponse;
}

function getCalendarStatus(game: Game, today: string): { label: string; className: string } {
  if (game.isProvisional || game.verdictLabel === "COMING SOON") {
    return { label: "Coming Soon", className: "text-accent bg-accent/10" };
  }

  if (game.score > 0) {
    return { label: "", className: "" };
  }

  if (!game.releaseDate) {
    return { label: "TBA", className: "text-tertiary bg-surface-2" };
  }

  const releaseDay = game.releaseDate.slice(0, 10);
  if (releaseDay > today) {
    return { label: "Coming Soon", className: "text-accent bg-accent/10" };
  }

  return { label: "Released", className: "text-score-good bg-score-good/10" };
}

export default function CalendarClientPage({ initialMonth, initialMonthData }: CalendarClientPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "All">("All");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const monthNavRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasDragged = useRef(false);
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = getCalendarMonthKey();

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const element = monthNavRef.current;
    if (!element) return;
    if ((e.target as HTMLElement).closest("button")) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartX.current = element.scrollLeft;
    element.setPointerCapture(e.pointerId);
    element.style.cursor = "grabbing";
    element.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !monthNavRef.current) return;
    const deltaX = e.clientX - dragStartX.current;
    if (Math.abs(deltaX) > 3) hasDragged.current = true;
    monthNavRef.current.scrollLeft = scrollStartX.current - deltaX;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!monthNavRef.current) return;
    isDragging.current = false;
    if (monthNavRef.current.hasPointerCapture(e.pointerId)) {
      monthNavRef.current.releasePointerCapture(e.pointerId);
    }
    monthNavRef.current.style.cursor = "grab";
    monthNavRef.current.style.userSelect = "";
    setTimeout(() => {
      hasDragged.current = false;
    }, 100);
  }, []);

  const monthOptions = useMemo(() => buildCalendarMonthOptions(initialMonth), [initialMonth]);

  useEffect(() => {
    if (!monthNavRef.current) {
      return;
    }

    const active = monthNavRef.current.querySelector("[data-active=true]");
    if (active) {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [initialMonth]);

  useEffect(() => {
    setCollapsedDays(new Set());
  }, [initialMonth]);

  const games = useMemo(() => {
    if (selectedPlatform === "All") {
      return initialMonthData.items;
    }

    const familyPlatforms = getFilterPlatforms(selectedPlatform);
    return initialMonthData.items.filter((game) => familyPlatforms.some((platform) => game.platforms.includes(platform)));
  }, [initialMonthData.items, selectedPlatform]);

  const grouped = useMemo(() => {
    if (!games.length) return {} as Record<string, Game[]>;
    const map: Record<string, Game[]> = {};
    for (const game of games) {
      const day = game.releaseDate?.slice(0, 10) ?? "TBA";
      (map[day] ??= []).push(game);
    }
    return Object.fromEntries(Object.entries(map).sort(([left], [right]) => left.localeCompare(right)));
  }, [games]);

  const toggleDay = useCallback((day: string) => {
    setCollapsedDays((previous) => {
      const next = new Set(previous);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }, []);

  const handleMonthChange = useCallback((month: string) => {
    if (month === initialMonth) {
      return;
    }

    startTransition(() => {
      router.replace(buildCalendarPagePath(month), { scroll: false });
    });
  }, [initialMonth, router]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 sm:py-10 space-y-8 page-enter overflow-x-hidden">
      <FadeInSection>
        <SectionHeader
          title="Release Calendar"
          icon={<CalendarDays className="w-5 h-5" />}
          subtitle="Upcoming and recent game launches"
          gradient="linear-gradient(90deg, #f59e0b 0%, #f97316 25%, #ef4444 50%, #f97316 75%, #f59e0b 100%)"
          headingTag="h1"
          className="mb-0"
        />
      </FadeInSection>

      <div className="sticky z-30 -mx-4 px-4 py-4 bg-background/80 backdrop-blur-xl border-b border-border" style={{ top: "var(--navbar-height, 56px)" }}>
        <div
          ref={monthNavRef}
          className="flex gap-1.5 overflow-x-auto py-1.5 scrollbar-hide cursor-grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {monthOptions.map((monthOption) => {
            const isCurrent = monthOption.key === currentMonth;
            return (
              <button
                key={monthOption.key}
                data-active={monthOption.key === initialMonth}
                onClick={(e) => {
                  if (hasDragged.current) {
                    e.preventDefault();
                    return;
                  }
                  handleMonthChange(monthOption.key);
                }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all relative ${
                  monthOption.key === initialMonth
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : isCurrent
                      ? "bg-accent/10 border border-accent/30 text-accent"
                      : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
                }`}
                disabled={isPending}
              >
                <span className="hidden sm:inline">{monthOption.label}</span>
                <span className="sm:hidden">{monthOption.shortLabel}</span>
                {isCurrent && monthOption.key !== initialMonth && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent ring-2 ring-background" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-hide">
          {PLATFORM_FILTER_OPTIONS.map((platformOption) => (
            <button
              key={platformOption.value}
              onClick={() => setSelectedPlatform(platformOption.value)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                platformOption.value === selectedPlatform
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-surface-2 text-tertiary border border-transparent hover:text-secondary hover:border-border"
              }`}
            >
              {platformOption.value !== "All" && (
                <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                  <PlatformIcon platform={platformOption.value} size={14} />
                </span>
              )}
              {platformOption.label}
            </button>
          ))}
          <span className="shrink-0 self-center text-[10px] text-tertiary ml-auto pl-2">
            {isPending ? "Loading…" : `${games.length} game${games.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {games.length > 0 ? (
          <motion.div
            key={initialMonth}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`space-y-4 transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}
          >
            {Object.entries(grouped).map(([date, dayGames]) => {
              const formatted = date === "TBA"
                ? "TBA"
                : new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  });
              const isCollapsed = collapsedDays.has(date);
              const isToday = date === today;

              return (
                <FadeInSection key={date}>
                  <div className="rounded-2xl border border-border bg-surface overflow-hidden">
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
                      <motion.span animate={{ rotate: isCollapsed ? -90 : 0 }} className="text-tertiary text-sm">
                        ▼
                      </motion.span>
                    </button>

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
                            {dayGames.map((game) => {
                              const status = getCalendarStatus(game, today);
                              return (
                                <Link
                                  key={game.id}
                                  href={`/game/${game.slug}`}
                                  className="group flex items-center gap-3 sm:gap-4 px-4 py-3.5 hover:bg-surface-2 transition-colors"
                                >
                                  <div className="relative w-14 h-[74px] sm:w-[72px] sm:h-24 shrink-0 rounded-lg overflow-hidden bg-surface-2">
                                    {game.coverImage ? (
                                      <Image
                                        src={game.coverImage}
                                        alt={game.title}
                                        fill
                                        className="object-cover"
                                        sizes="72px"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-tertiary">
                                        <Gamepad2 className="w-5 h-5" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-1">
                                    <h4 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                                      {game.title}
                                    </h4>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        {(() => {
                                          const { visible, overflow } = collapsePlatforms(game.platforms, 4);
                                          return (
                                            <>
                                              {visible.map((platform) => (
                                                <PlatformIcon key={platform} platform={platform} size={12} />
                                              ))}
                                              {overflow > 0 && (
                                                <span className="text-[9px] text-tertiary">+{overflow}</span>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                      {game.genres.slice(0, 2).map((genre) => (
                                        <span key={genre} className="text-[10px] text-tertiary bg-surface-2 px-1.5 py-0.5 rounded">
                                          {genre}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    {game.score > 0 && !(game.releaseDate && game.releaseDate.slice(0, 10) > today) ? (
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
                                      <span className={`text-[10px] font-medium px-2 py-1 rounded-lg ${status.className}`}>
                                        {status.label}
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
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
            className={`text-center py-16 space-y-4 transition-opacity ${isPending ? "opacity-60" : ""}`}
          >
            <CalendarX className="w-10 h-10 text-accent mx-auto" />
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
