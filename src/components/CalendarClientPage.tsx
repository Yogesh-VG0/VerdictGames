"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";
import SectionHeader from "@/components/SectionHeader";
import HeroImage from "@/components/ui/HeroImage";
import PlatformIcon, {
  PLATFORM_FILTER_OPTIONS,
  getFilterPlatforms,
} from "@/components/ui/PlatformIcon";
import { getCalendarGames } from "@/lib/api";
import { collapsePlatforms } from "@/lib/utils/platform";
import { buildCalendarMonthOptions, buildCalendarPagePath } from "@/lib/utils/gx-calendar";
import type { CalendarGame, CalendarMonthResponse, Platform } from "@/lib/types";
import { ArrowUpRight, CalendarDays, Gamepad2, CalendarX } from "lucide-react";

interface CalendarClientPageProps {
  initialMonth: string;
  initialMonthData: CalendarMonthResponse;
  today: string;
  currentMonth: string;
}

const calendarDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const calendarMetaFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatCalendarDay(date: string): string {
  return calendarDayFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatCalendarMetaDate(date: string): string {
  return calendarMetaFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatCalendarTagLabel(value: string): string {
  const normalized = value.trim();
  const upper = normalized.toUpperCase();

  switch (upper) {
    case "EARLY ACCESS":
      return "Early Access";
    case "PC":
    case "WINDOWS":
      return "PC";
    case "SWITCH":
      return "Switch";
    case "SWITCH 2":
      return "Switch 2";
    case "PLAYSTATION":
    case "PS5":
      return "PlayStation";
    case "XBOX":
      return "Xbox";
    case "ANDROID":
      return "Android";
    case "IOS":
      return "iOS";
    case "MAC":
    case "MACOS":
      return "Mac";
    case "LINUX":
      return "Linux";
    case "VR":
      return "VR";
    case "HOT":
      return "Hot";
    case "EVENT":
      return "Event";
    default:
      return normalized
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function getCalendarLaunchLabel(game: CalendarGame): string | null {
  const originalDay = game.calendarOriginalReleaseDate?.slice(0, 10) ?? null;
  const entryDay = game.releaseDate?.slice(0, 10) ?? null;
  const platformLaunchTags = ["PC", "Switch", "Switch 2", "PlayStation", "Xbox", "Android", "iOS", "Mac", "Linux", "VR"];

  if (!originalDay || !entryDay || originalDay >= entryDay) {
    return null;
  }

  if (game.calendarEntryTag) {
    const formattedTag = formatCalendarTagLabel(game.calendarEntryTag);
    if (platformLaunchTags.includes(formattedTag)) {
      return `${formattedTag} Launch`;
    }

    return null;
  }

  const fallbackPlatform = game.calendarEntryPlatformNames?.[0] ?? game.calendarEntryPlatforms?.[0];
  if (fallbackPlatform) {
    return `${formatCalendarTagLabel(String(fallbackPlatform))} Launch`;
  }

  return "Platform Launch";
}

function getCalendarContextBadge(game: CalendarGame): { label: string; color: string | null } | null {
  const launchLabel = getCalendarLaunchLabel(game);
  if (launchLabel) {
    return { label: launchLabel, color: game.calendarEntryTagColor ?? "#4d4dff" };
  }

  if (game.calendarEntryTag) {
    return {
      label: formatCalendarTagLabel(game.calendarEntryTag),
      color: game.calendarEntryTagColor ?? null,
    };
  }

  if (game.calendarIsHot) {
    return { label: "Hot", color: "#f10808" };
  }

  return null;
}

function getCalendarContextNote(game: CalendarGame): string | null {
  const originalDay = game.calendarOriginalReleaseDate?.slice(0, 10) ?? null;
  const entryDay = game.releaseDate?.slice(0, 10) ?? null;

  if (!originalDay || !entryDay || originalDay >= entryDay) {
    return null;
  }

  return `Originally released ${formatCalendarMetaDate(originalDay)}`;
}

function getCalendarExternalLabel(game: CalendarGame): string {
  const rawLabel = game.calendarCtaLabel?.trim();
  if (!rawLabel) {
    return "Store";
  }

  return rawLabel.toLowerCase() === "check" ? "Check Store" : rawLabel;
}

function getCalendarStatus(game: CalendarGame, today: string): { label: string; className: string } {
  if (!game.releaseDate) {
    return { label: "TBA", className: "text-tertiary bg-surface-2" };
  }

  const entryDay = game.releaseDate.slice(0, 10);
  if (entryDay > today) {
    return { label: "Coming Soon", className: "text-accent bg-accent/10" };
  }

  if (game.score > 0) {
    return { label: "", className: "" };
  }

  return { label: "Released", className: "text-score-good bg-score-good/10" };
}

export default function CalendarClientPage({ initialMonth, initialMonthData, today, currentMonth }: CalendarClientPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [monthData, setMonthData] = useState(initialMonthData);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "All">("All");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const monthNavRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasDragged = useRef(false);
  const monthRequestId = useRef(0);
  const currentMonthDate = useMemo(() => new Date(`${currentMonth}-01T00:00:00Z`), [currentMonth]);

  useEffect(() => {
    monthRequestId.current += 1;
    setSelectedMonth(initialMonth);
    setMonthData(initialMonthData);
    setIsMonthLoading(false);
  }, [initialMonth, initialMonthData]);

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

  const monthOptions = useMemo(() => buildCalendarMonthOptions(selectedMonth, currentMonthDate), [currentMonthDate, selectedMonth]);

  useEffect(() => {
    if (!monthNavRef.current) {
      return;
    }

    const active = monthNavRef.current.querySelector("[data-active=true]");
    if (active) {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedMonth]);

  useEffect(() => {
    setCollapsedDays(new Set());
  }, [selectedMonth]);

  const games = useMemo(() => {
    if (selectedPlatform === "All") {
      return monthData.items;
    }

    const familyPlatforms = getFilterPlatforms(selectedPlatform);
    return monthData.items.filter((game) => {
      const platforms = game.calendarEntryPlatforms ?? game.platforms;
      return familyPlatforms.some((platform) => platforms.includes(platform));
    });
  }, [monthData.items, selectedPlatform]);

  const grouped = useMemo(() => {
    if (!games.length) return {} as Record<string, CalendarGame[]>;
    const map: Record<string, CalendarGame[]> = {};
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

  const loadMonth = useCallback(async (month: string) => {
    const requestId = ++monthRequestId.current;
    setIsMonthLoading(true);
    const data = await getCalendarGames(month);

    if (monthRequestId.current !== requestId) {
      return;
    }

    setMonthData(data);
    setIsMonthLoading(false);
  }, []);

  const handleMonthChange = useCallback((month: string) => {
    if (month === selectedMonth) {
      return;
    }

    hasDragged.current = false;
    setSelectedMonth(month);
    setCollapsedDays(new Set());
    setIsMonthLoading(true);
    window.history.replaceState(window.history.state, "", buildCalendarPagePath(month));
    void loadMonth(month);
  }, [loadMonth, selectedMonth]);

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
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {monthOptions.map((monthOption) => {
            const isCurrent = monthOption.key === currentMonth;
            return (
              <button
                key={monthOption.key}
                data-active={monthOption.key === selectedMonth}
                onPointerDown={() => {
                  hasDragged.current = false;
                }}
                onClick={(e) => {
                  if (hasDragged.current) {
                    e.preventDefault();
                    return;
                  }
                  handleMonthChange(monthOption.key);
                }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all relative ${
                  monthOption.key === selectedMonth
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : isCurrent
                      ? "bg-accent/10 border border-accent/30 text-accent"
                      : "bg-surface border border-border text-secondary hover:text-foreground hover:border-border-hover"
                }`}
              >
                <span className="hidden sm:inline">{monthOption.label}</span>
                <span className="sm:hidden">{monthOption.shortLabel}</span>
                {isCurrent && monthOption.key !== selectedMonth && (
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
            {isMonthLoading ? "Loading…" : `${games.length} game${games.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {games.length > 0 ? (
          <motion.div
            key={selectedMonth}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`space-y-4 transition-opacity ${isMonthLoading ? "opacity-60" : ""}`}
          >
            {Object.entries(grouped).map(([date, dayGames]) => {
              const formatted = date === "TBA"
                ? "TBA"
                : formatCalendarDay(date);
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
                              const contextBadge = getCalendarContextBadge(game);
                              const contextNote = getCalendarContextNote(game);
                              const primaryHref = game.calendarHasDetailPage && game.slug ? `/game/${game.slug}` : game.calendarUrl;
                              const primaryIsExternal = !game.calendarHasDetailPage && Boolean(game.calendarUrl);
                              const externalHref = game.calendarHasDetailPage ? game.calendarUrl : null;
                              const rowClassName = "flex items-center gap-3 sm:gap-4 px-4 py-3.5";
                              const mainContentClassName = `flex min-w-0 flex-1 items-center gap-3 sm:gap-4 ${primaryHref ? "group hover:bg-surface-2 transition-colors rounded-xl -m-2 p-2" : ""}`;

                              const rowContent = (
                                <>
                                  <div className="relative w-14 h-[74px] sm:w-[72px] sm:h-24 shrink-0 rounded-lg overflow-hidden bg-surface-2">
                                    {game.coverImage ? (
                                      <HeroImage
                                        src={game.coverImage}
                                        alt={game.title}
                                        sizes="72px"
                                        className="object-cover"
                                        fallbackClassName="bg-surface-2"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-tertiary">
                                        <Gamepad2 className="w-5 h-5" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <h4 className={`text-sm font-semibold text-foreground line-clamp-1 ${primaryHref ? "group-hover:text-accent transition-colors" : ""}`}>
                                        {game.title}
                                      </h4>
                                      {primaryIsExternal && <ArrowUpRight className="w-3.5 h-3.5 text-tertiary shrink-0" />}
                                    </div>

                                    {(contextBadge || contextNote) && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {contextBadge && (
                                          <span
                                            className="text-[10px] font-medium px-2 py-1 rounded-lg border bg-surface-2"
                                            style={{
                                              color: contextBadge.color ?? undefined,
                                              borderColor: contextBadge.color ?? undefined,
                                            }}
                                          >
                                            {contextBadge.label}
                                          </span>
                                        )}
                                        {contextNote && (
                                          <span className="text-[11px] text-secondary">
                                            {contextNote}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        {(() => {
                                          const { visible, overflow } = collapsePlatforms(game.calendarEntryPlatforms ?? game.platforms, 4);
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
                                </>
                              );

                              return (
                                <div key={game.id} className={rowClassName}>
                                  {primaryHref ? (
                                    <Link
                                      href={primaryHref}
                                      target={primaryIsExternal ? "_blank" : undefined}
                                      rel={primaryIsExternal ? "noreferrer" : undefined}
                                      prefetch={primaryIsExternal ? undefined : false}
                                      className={mainContentClassName}
                                    >
                                      {rowContent}
                                    </Link>
                                  ) : (
                                    <div className={mainContentClassName}>
                                      {rowContent}
                                    </div>
                                  )}

                                  {externalHref && (
                                    <a
                                      href={externalHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-secondary border border-border bg-surface-2 hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-colors"
                                    >
                                      {getCalendarExternalLabel(game)}
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
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
            className={`text-center py-16 space-y-4 transition-opacity ${isMonthLoading ? "opacity-60" : ""}`}
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
