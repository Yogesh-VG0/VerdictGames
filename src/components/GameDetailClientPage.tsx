"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  getGameBySlug,
  getGameReviews,
  getRelatedGames,
  getGameNews,
  getGameAchievements,
  getSystemRequirements,
  getEditorialReviews,
  type EditorialReview,
  type SteamNewsData,
  type SteamAchievementsData,
  type SystemRequirementsData,
  type SteamReviewsData,
} from "@/lib/api";
import SteamReviews from "@/components/SteamReviews";
import type { SteamNewsArticle, SteamAchievementItem } from "@/lib/api";
import type { Game, PaginatedResponse, Review } from "@/lib/types";
import { formatDate, scoreColor, cn, formatPrice, scoreGlowClass, formatTimeAgo } from "@/lib/utils";
import PlatformIcon from "@/components/ui/PlatformIcon";
import HeroImage from "@/components/ui/HeroImage";
import SafeImage from "@/components/ui/SafeImage";
import ScoreRing from "@/components/ui/ScoreRing";
import VerdictBadge from "@/components/ui/VerdictBadge";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";
import MediaCarousel from "@/components/MediaCarousel";
import ReviewCard from "@/components/ReviewCard";
import GameGrid from "@/components/GameGrid";
import SectionHeader from "@/components/SectionHeader";
import FadeInSection from "@/components/FadeInSection";
import ScoreChips from "@/components/ScoreChips";
import { Skeleton } from "@/components/ui/Skeleton";
import LibraryStatusSelector from "@/components/LibraryStatusSelector";
import ReviewForm from "@/components/ReviewForm";
import CommentThread from "@/components/CommentThread";
import AuthModal from "@/components/AuthModal";
import { getGameNotices } from "@/lib/utils/gameNotices";
import { slugify } from "@/lib/utils/slugify";
import {
  Zap, Trophy, Newspaper, MessageSquare, Clock,
  BarChart3, Target, ThumbsUp, ThumbsDown, Gamepad2,
  Smartphone, Tag, Globe, ChevronLeft, ChevronRight, Monitor, Share2, Home, Copy, Check,
  ArrowUpRight, Building2,
} from "lucide-react";

interface GameDetailClientPageProps {
  slug: string;
  rawgId?: number | null;
  initialGame: Game;
  initialReviewsData?: PaginatedResponse<Review>;
  initialRelated?: Game[];
  initialNewsData?: SteamNewsData;
  initialAchievementsData?: SteamAchievementsData;
  initialSystemRequirements?: SystemRequirementsData;
  initialEditorialReviews?: EditorialReview[];
  initialSteamReviewsData?: SteamReviewsData;
}

/** Visual stat bar component */
function StatBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-secondary">{label}</span>
        <span className={cn("font-bold tabular-nums", color)}>{value}</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full stat-bar-fill", color === "text-score-great" ? "bg-score-great" : color === "text-score-good" ? "bg-score-good" : color === "text-score-mixed" ? "bg-score-mixed" : "bg-score-bad")}
          style={{ "--fill-width": `${pct}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

const LIVE_PLAYER_FRESHNESS_HOURS = 8;

function getTimestampAgeHours(iso?: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - timestamp) / 3600000);
}

export default function GameDetailClientPage({
  slug,
  rawgId = null,
  initialGame,
  initialReviewsData,
  initialRelated,
  initialNewsData,
  initialAchievementsData,
  initialSystemRequirements,
  initialEditorialReviews,
  initialSteamReviewsData,
}: GameDetailClientPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [achievementsPage, setAchievementsPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [slug]);

  // Close share dropdown on outside click or Escape
  useEffect(() => {
    if (!shareOpen) return;
    function handleClick(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShareOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [shareOpen]);

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", slug, rawgId ?? null],
    queryFn: () => getGameBySlug(slug, rawgId ?? undefined),
    initialData: initialGame,
    enabled: !initialGame.isPreview,
    staleTime: 60 * 1000,
  });

  const { data: reviewsData, isLoading: isReviewsLoading } = useQuery({
    queryKey: ["gameReviews", slug],
    queryFn: () => getGameReviews(slug, { sort: "helpful" }),
    enabled: !!game && !initialGame.isPreview,
    initialData: initialReviewsData,
    staleTime: 60 * 1000,
  });

  const { data: related } = useQuery({
    queryKey: ["relatedGames", slug],
    queryFn: () => getRelatedGames(slug),
    enabled: !!game && !initialGame.isPreview,
    initialData: initialRelated,
    staleTime: 10 * 60 * 1000,
  });

  const { data: newsData } = useQuery({
    queryKey: ["gameNews", slug],
    queryFn: () => getGameNews(slug, 5),
    enabled: !!game && !initialGame.isPreview,
    initialData: initialNewsData,
    staleTime: 10 * 60 * 1000,
  });

  const { data: achievementsData } = useQuery({
    queryKey: ["gameAchievements", slug],
    queryFn: () => getGameAchievements(slug, 50),
    enabled: !!game && !initialGame.isPreview,
    initialData: initialAchievementsData,
    staleTime: 10 * 60 * 1000,
  });

  const { data: sysReqData, isLoading: isSystemRequirementsLoading } = useQuery({
    queryKey: ["systemRequirements", slug],
    queryFn: () => getSystemRequirements(slug),
    enabled: !!game && !initialGame.isPreview && !!game.platforms?.includes("PC"),
    initialData: initialSystemRequirements,
    staleTime: 60 * 60 * 1000,
  });

  const { data: editorialReviews } = useQuery({
    queryKey: ["editorialReviews", slug],
    queryFn: () => getEditorialReviews(slug),
    enabled: !!game && !initialGame.isPreview,
    initialData: initialEditorialReviews,
    staleTime: 60 * 60 * 1000,
  });

  const ACHIEVEMENTS_PER_PAGE = 10;

  const renderAchievements = useCallback(() => {
    if (!achievementsData || achievementsData.achievements.length === 0) return null;
    const totalAchPages = Math.ceil(achievementsData.achievements.length / ACHIEVEMENTS_PER_PAGE);
    const pageItems = achievementsData.achievements.slice(
      (achievementsPage - 1) * ACHIEVEMENTS_PER_PAGE,
      achievementsPage * ACHIEVEMENTS_PER_PAGE
    );

    const getAchPageNumbers = () => {
      const pages: (number | "...")[] = [];
      if (totalAchPages <= 7) {
        for (let i = 1; i <= totalAchPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (achievementsPage > 3) pages.push("...");
        for (let i = Math.max(2, achievementsPage - 1); i <= Math.min(totalAchPages - 1, achievementsPage + 1); i++) {
          pages.push(i);
        }
        if (achievementsPage < totalAchPages - 2) pages.push("...");
        pages.push(totalAchPages);
      }
      return pages;
    };

    return (
      <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            Achievements
          </h3>
          <span className="text-[10px] font-medium text-tertiary bg-surface-2 border border-border rounded-full px-2 py-0.5 shrink-0">
            {achievementsData.total} total
          </span>
        </div>
        <div className="space-y-2">
          {pageItems.map((ach: SteamAchievementItem) => (
            <div
              key={ach.name}
              className="flex items-center gap-3 p-2 rounded-xl bg-surface-2 border border-border hover:border-accent/30 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ach.icon}
                alt={ach.name}
                width={36}
                height={36}
                className="rounded-lg shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{ach.name}</p>
                {ach.description && (
                  <p className="text-[10px] text-tertiary truncate">{ach.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className={cn(
                  "text-xs font-bold tabular-nums",
                  ach.globalUnlockPercent >= 50 ? "text-score-great" :
                  ach.globalUnlockPercent >= 20 ? "text-score-good" :
                  ach.globalUnlockPercent >= 5 ? "text-score-mixed" : "text-score-bad"
                )}>
                  {ach.globalUnlockPercent}%
                </p>
                <p className="text-[9px] text-tertiary">unlocked</p>
              </div>
            </div>
          ))}
        </div>
        {/* Numbered pagination */}
        {totalAchPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <button
              onClick={() => setAchievementsPage((p) => Math.max(1, p - 1))}
              disabled={achievementsPage === 1}
              className="p-1.5 rounded-lg border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            {getAchPageNumbers().map((pg, i) =>
              pg === "..." ? (
                <span key={`ach-ellipsis-${i}`} className="px-1 text-[10px] text-tertiary">…</span>
              ) : (
                <button
                  key={pg}
                  onClick={() => setAchievementsPage(pg)}
                  className={cn(
                    "min-w-[26px] h-[26px] rounded-lg text-[10px] font-medium transition-colors",
                    pg === achievementsPage
                      ? "bg-accent text-white"
                      : "text-secondary hover:text-foreground hover:bg-surface-2 border border-border"
                  )}
                >
                  {pg}
                </button>
              )
            )}
            <button
              onClick={() => setAchievementsPage((p) => Math.min(totalAchPages, p + 1))}
              disabled={achievementsPage === totalAchPages}
              className="p-1.5 rounded-lg border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </section>
    );
  }, [achievementsData, achievementsPage]);

  if (isLoading) {
    return (
      <div className="space-y-0">
        <section className="relative">
          <Skeleton className="w-full h-[50vh] md:h-[60vh] min-h-[320px] max-h-[600px] rounded-none" />
          <div className="absolute bottom-0 left-0 right-0">
            <div className="max-w-6xl mx-auto px-4 pb-8 md:pb-12 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-10 md:h-14 w-80 max-w-full rounded-xl" />
              <Skeleton className="h-4 w-64 rounded-lg" />
            </div>
          </div>
        </section>
        <div className="max-w-[1400px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="p-5 md:p-6">
                  <div className="flex items-start gap-5">
                    <Skeleton className="w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-28 rounded-full" />
                      <Skeleton className="h-4 w-full rounded-lg" />
                      <Skeleton className="h-4 w-3/4 rounded-lg" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/30">
                  {[0, 1].map((col) => (
                    <div key={col} className="p-5 space-y-2.5">
                      <Skeleton className="h-4 w-24 rounded-lg" />
                      <Skeleton className="h-3 w-full rounded" />
                      <Skeleton className="h-3 w-5/6 rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <Skeleton className="h-4 w-16 rounded-lg" />
                <Skeleton className="aspect-video w-full rounded-xl" />
              </div>
            </div>
            <div className="lg:col-span-4 space-y-6">
              <Skeleton className="h-12 w-full rounded-xl" />
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <Skeleton className="h-4 w-28 rounded-lg" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <Skeleton className="h-4 w-16 rounded-lg" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-5xl">🕹️</div>
        <h2 className="text-xl font-bold text-foreground">Game not found</h2>
        <p className="text-sm text-secondary">
          The game you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link href="/" prefetch={false}>
          <PixelButton as="span" variant="secondary">Back to Home</PixelButton>
        </Link>
      </div>
    );
  }

  const currentPrice = formatPrice(game.priceCurrent, game.priceCurrency);
  const lowestPrice = formatPrice(game.priceLowest, game.priceCurrency);
  const sc = scoreColor(game.score);
  const isPreviewGame = game.isPreview === true;
  const isProvisional = game.isProvisional || game.releaseStatus === "upcoming" || game.verdictLabel === "COMING SOON";
  const notices = getGameNotices(game);
  const developerName = game.developer?.trim() || null;
  const developerHref = developerName ? `/developers/${encodeURIComponent(slugify(developerName))}` : null;
  const playerStatsAgeHours = getTimestampAgeHours(game.playersUpdatedAt);
  const hasFreshPlayerStats = playerStatsAgeHours <= LIVE_PLAYER_FRESHNESS_HOURS;
  const playerStatsLabel = hasFreshPlayerStats ? "Playing Now" : "Recent Players";
  const playerStatsTimestampLabel = game.playersUpdatedAt
    ? `${hasFreshPlayerStats ? "Updated" : "Last updated"} ${formatTimeAgo(game.playersUpdatedAt)}`
    : null;

  return (
    <div className="space-y-0">
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative">
        <div className="relative h-[50vh] md:h-[60vh] min-h-[320px] max-h-[600px] overflow-hidden">
          {game.headerImage ? (
            <HeroImage
              src={game.headerImage}
              alt={game.title}
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/20 via-surface to-pixel-cyan/10 flex items-center justify-center">
              <span className="text-7xl opacity-30">🎮</span>
            </div>
          )}
          {/* Multi-layer gradients — always dark so images stay vibrant */}
          <div className="absolute inset-0 hero-gradient-bottom" />
          <div className="absolute inset-0 hero-gradient-right" />
          <div className="absolute inset-0 hero-gradient-vignette" />
        </div>

        {/* Hero content overlaid at bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-6xl mx-auto px-4 pb-8 md:pb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-3"
            >
              {/* Platform + Year */}
              <div className="flex flex-wrap gap-2 items-center">
                {game.platforms.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/15 text-xs font-medium text-white/90">
                    <PlatformIcon platform={p} size={14} />
                    {p}
                  </span>
                ))}
                {game.isFree && (
                  <PixelBadge variant="success" size="md">Free to Play</PixelBadge>
                )}
                {game.releaseDate && (
                  <span className="text-xs hero-overlay-text-muted font-medium ml-1">
                    {formatDate(game.releaseDate)}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold hero-overlay-text leading-[1.1] max-w-3xl drop-shadow-lg">
                {game.title}
              </h1>
              {game.subtitle && (
                <p className="text-sm md:text-base hero-overlay-text-secondary max-w-2xl">{game.subtitle}</p>
              )}

              {/* Quick info chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs hero-overlay-text-muted">
                {developerName && developerHref ? (
                  <Link
                    href={developerHref}
                    prefetch={false}
                    className="group inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/12 px-3 py-1.5 text-white transition-all hover:border-accent hover:bg-accent/18 hover:shadow-[0_0_20px_-10px_rgba(34,211,238,0.65)]"
                    aria-label={`Open developer page for ${developerName}`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    <span className="font-semibold text-white">{developerName}</span>
                    <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.14em] text-accent/90">
                      Developer Hub
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                ) : developerName ? (
                  <span className="bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/15">
                    {developerName}
                  </span>
                ) : null}
                {game.genres.slice(0, 3).map((g) => (
                  <span key={g} className="bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/15">
                    {g}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Breadcrumbs + Share */}
        <div className="flex items-center justify-between mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-tertiary overflow-hidden">
            <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0">
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="w-3 h-3 shrink-0" />
            {game.genres[0] && (
              <>
                <Link href={`/search?genre=${encodeURIComponent(game.genres[0])}`} className="hover:text-foreground transition-colors shrink-0">
                  {game.genres[0]}
                </Link>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </>
            )}
            <span className="text-foreground font-medium truncate">{game.title}</span>
          </nav>
          <div className="relative shrink-0" ref={shareRef}>
            <button
              onClick={() => setShareOpen(!shareOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-secondary hover:text-foreground border border-border hover:border-accent/30 bg-surface transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface border border-border shadow-2xl z-50 overflow-hidden animate-scale-in">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setTimeout(() => { setCopied(false); setShareOpen(false); }, 1500);
                  }}
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${game.title} on verdict.games`)}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Share on X
                </a>
                <a
                  href={`https://reddit.com/submit?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&title=${encodeURIComponent(game.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Share on Reddit
                </a>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ─── MAIN CONTENT (ABOVE REVIEWS) ─── */}
          <div className="order-1 lg:col-span-8 space-y-8">

            {/* ── Verdict Card / Provisional Banner ── */}
            <FadeInSection>
              {isProvisional || isPreviewGame ? (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="rounded-2xl border border-accent/20 bg-surface overflow-hidden"
                >
                  <div className="p-6 md:p-8 text-center space-y-4">
                    <div className="text-4xl">🚀</div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      <span className="text-sm font-bold text-accent uppercase tracking-wider">
                        {isPreviewGame
                          ? "Preview"
                          : game.releaseStatus === "tba"
                            ? "To Be Announced"
                            : game.releaseStatus === "announced"
                              ? "Announced"
                              : "Coming Soon"}
                      </span>
                    </div>
                    <p className="text-sm text-secondary max-w-md mx-auto leading-relaxed">
                      {isPreviewGame
                        ? `This page uses external metadata while verdict.games prepares full tracking, reviews, and richer coverage for ${game.title}.`
                        : "This game page is awaiting full data enrichment. Scores, reviews, and detailed information will be populated automatically when source data becomes available."}
                    </p>
                    {game.releaseDate && (
                      <p className="text-xs text-tertiary">
                        {isPreviewGame && !isProvisional ? "Release date: " : "Expected release: "}
                        <span className="text-foreground font-medium">{formatDate(game.releaseDate)}</span>
                      </p>
                    )}
                  </div>
                </motion.section>
              ) : (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="rounded-2xl border border-border bg-surface overflow-hidden"
              >
                {/* Score header band */}
                <div className="relative p-4 sm:p-5 md:p-6 mesh-gradient">
                  <div className="flex items-start gap-4 sm:gap-5 md:gap-6">
                    <div className={cn("shrink-0 rounded-xl", scoreGlowClass(game.score))}>
                      <ScoreRing score={game.score} size={72} strokeWidth={4} className="relative sm:hidden" />
                      <ScoreRing score={game.score} size={88} strokeWidth={5} className="relative hidden sm:block" />
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <VerdictBadge label={game.verdictLabel} size="lg" />
                      </div>
                      <p className="text-sm md:text-base text-secondary leading-relaxed">
                        {game.verdictSummary}
                      </p>
                    </div>
                  </div>

                  {/* Rating breakdown */}
                  <div className="mt-5 pt-4 border-t border-border/50 space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center space-y-0.5">
                        <p className={cn("text-xl font-bold", sc)}>{game.score}</p>
                        <p className="text-[10px] text-tertiary uppercase tracking-wider">Verdict</p>
                      </div>
                      <div className="text-center space-y-0.5">
                        <p className={cn("text-xl font-bold", game.userScore ? scoreColor(game.userScore) : "text-tertiary")}>
                          {game.userScore ? `${game.userScore}%` : "—"}
                        </p>
                        <p className="text-[10px] text-tertiary uppercase tracking-wider">Steam</p>
                      </div>
                      <div className="text-center space-y-0.5">
                        <p className={cn("text-xl font-bold", game.igdbRating ? scoreColor(game.igdbRating) : "text-tertiary")}>
                          {game.igdbRating ? Math.round(game.igdbRating) : "—"}
                        </p>
                        <p className="text-[10px] text-tertiary uppercase tracking-wider">IGDB</p>
                      </div>
                    </div>
                    <ScoreChips game={game} variant="full" className="justify-center" />
                    <p className="text-[9px] text-tertiary text-center flex items-center justify-center gap-1">
                      Verdict score based on {game.scoreSource === "steam" ? "confidence-adjusted Steam reviews" : game.scoreSource === "igdb" || game.scoreSource === "metacritic" ? "critic coverage and platform signals" : "limited cross-platform signals"}
                      <span
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-surface-2 border border-border text-tertiary hover:text-accent hover:border-accent/30 cursor-help transition-colors"
                        title="The Verdict Score is not a raw store percentage. Steam-backed games use confidence-adjusted review evidence, while non-Steam titles rely more on critic coverage and weaker cross-platform community proxies. Premium homepage rails apply stricter evidence and activity requirements on top of this base score."
                      >
                        ?
                      </span>
                    </p>
                  </div>
                </div>

                {/* Pros & Cons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                  <div className="p-5 space-y-2.5">
                    <h4 className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      What works
                    </h4>
                    {game.pros.map((pro, i) => (
                      <p key={i} className="text-sm text-secondary pl-3 border-l-2 border-success/30">
                        {pro}
                      </p>
                    ))}
                  </div>
                  <div className="p-5 space-y-2.5">
                    <h4 className="text-xs font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      What doesn&apos;t
                    </h4>
                    {game.cons.map((con, i) => (
                      <p key={i} className="text-sm text-secondary pl-3 border-l-2 border-danger/30">
                        {con}
                      </p>
                    ))}
                  </div>
                </div>
              </motion.section>
              )}
            </FadeInSection>

            {notices.map((notice) => (
              <FadeInSection key={notice.id}>
                <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 md:p-6">
                  <div className="flex items-start gap-3">
                    <Tag className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        {notice.title}
                      </h3>
                      <p className="text-sm text-secondary leading-relaxed">{notice.body}</p>
                      {notice.ctaHref && notice.ctaLabel && (
                        <Link
                          href={notice.ctaHref}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                        >
                          {notice.ctaLabel}
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </section>
              </FadeInSection>
            ))}

            {/* ── Verdict Review (Editorial) ── */}
            {editorialReviews && editorialReviews.length > 0 && (
              <FadeInSection>
                <section className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5 md:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Verdict Review
                  </h3>
                  {editorialReviews.map((review) => (
                    <div key={review.id} className="space-y-4">
                      {/* Author & Meta */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
                          {review.profiles.avatar_url ? (
                            <SafeImage src={review.profiles.avatar_url} alt="" width={40} height={40} className="object-cover" />
                          ) : (
                            <span className="text-accent font-bold text-sm">
                              {(review.profiles.display_name || review.profiles.username).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {review.profiles.display_name || review.profiles.username}
                            <span className="ml-2 text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-medium">Editor</span>
                          </p>
                          <p className="text-xs text-tertiary">
                            {review.playtime_hours && `${review.playtime_hours}h played`}
                            {review.playtime_hours && review.platform_played && " • "}
                            {review.platform_played && `on ${review.platform_played}`}
                            {(review.playtime_hours || review.platform_played) && review.published_at && " • "}
                            {review.published_at && formatTimeAgo(review.published_at)}
                          </p>
                        </div>
                      </div>

                      {/* Title */}
                      {review.title && (
                        <h4 className="text-lg font-bold text-foreground">{review.title}</h4>
                      )}

                      {/* Content */}
                      <div className="text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                        {review.content}
                      </div>

                      {/* Pros/Cons */}
                      {(review.pros.length > 0 || review.cons.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          {review.pros.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-bold text-pixel-green uppercase tracking-wider flex items-center gap-1.5">
                                <ThumbsUp className="w-3.5 h-3.5" />
                                What works
                              </h5>
                              {review.pros.map((pro, i) => (
                                <p key={i} className="text-sm text-secondary pl-3 border-l-2 border-pixel-green/30">
                                  {pro}
                                </p>
                              ))}
                            </div>
                          )}
                          {review.cons.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                                <ThumbsDown className="w-3.5 h-3.5" />
                                What doesn&apos;t
                              </h5>
                              {review.cons.map((con, i) => (
                                <p key={i} className="text-sm text-secondary pl-3 border-l-2 border-danger/30">
                                  {con}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              </FadeInSection>
            )}

            {/* ── Overview / Description ── */}
            <FadeInSection>
              <section className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                  Overview
                </h3>
                <p className="text-secondary text-sm leading-relaxed">{game.description}</p>

                {/* Tags */}
                {game.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {game.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-tertiary bg-white/5 px-2.5 py-1 rounded-full border border-border hover:border-accent/30 hover:text-accent transition-colors cursor-default"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </FadeInSection>

            {/* ── Media ── */}
            <FadeInSection>
              {(game.screenshots.length > 0 || game.trailerUrl) && (
                <section className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                    Media
                  </h3>

                  {/* Trailer — embedded YouTube player */}
                  {game.trailerUrl && (() => {
                    const videoId = game.trailerUrl.match(/(?:v=|\/embed\/|youtu\.be\/)([^&?#]+)/)?.[1];
                    if (!videoId) return null;
                    return (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-border">
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
                          title={`${game.title} trailer`}
                          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                    );
                  })()}

                  {/* Screenshots carousel */}
                  {game.screenshots.length > 0 && (
                    <MediaCarousel images={game.screenshots} alt={game.title} />
                  )}
                </section>
              )}
            </FadeInSection>

            {/* ── Performance & System Requirements ── */}
            <FadeInSection>
              <section className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" /> Performance
                </h3>
                <p className="text-secondary text-sm leading-relaxed">
                  {game.performanceNotes || (
                    game.platforms.includes("PC")
                      ? "Runs well on modern hardware."
                      : game.platforms.some((p) => p.startsWith("PlayStation") || p.startsWith("Xbox") || p.startsWith("Nintendo"))
                        ? "Optimized for console hardware. Performance may vary by model."
                        : game.platforms.some((p) => p === "Android" || p === "iOS")
                          ? "Optimized for mobile devices. Performance varies by device."
                          : "Performance details not available yet."
                  )}
                </p>
                {/* System requirements from Steam API — side-by-side on desktop */}
                {sysReqData?.requirements?.pc && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <p className="text-[11px] uppercase tracking-wider text-tertiary font-semibold flex items-center gap-1.5 pt-2">
                      <Monitor className="w-3.5 h-3.5" /> System Requirements
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {sysReqData.requirements.pc.minimum && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Minimum</p>
                          <div className="grid gap-1.5">
                            {Object.entries(sysReqData.requirements.pc.minimum).map(([key, val]) => (
                              <div key={key} className="text-[11px]">
                                <span className="text-tertiary font-medium block">{key}</span>
                                <span className="text-secondary">{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {sysReqData.requirements.pc.recommended && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Recommended</p>
                          <div className="grid gap-1.5">
                            {Object.entries(sysReqData.requirements.pc.recommended).map(([key, val]) => (
                              <div key={key} className="text-[11px]">
                                <span className="text-tertiary font-medium block">{key}</span>
                                <span className="text-secondary">{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Fallback link to Steam */}
                {!isSystemRequirementsLoading && !sysReqData?.requirements?.pc && game.platforms.includes("PC") && game.steamUrl && (
                  <a
                    href={`${game.steamUrl}#sysreq_content`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-pixel-cyan hover:text-pixel-cyan/80 transition-colors font-medium"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    View system requirements on Steam →
                  </a>
                )}
              </section>
            </FadeInSection>

            {/* ── Steam Achievements (mobile only — desktop renders in sidebar) ── */}
            {achievementsData && achievementsData.achievements.length > 0 && (
              <div className="lg:hidden">
                <FadeInSection>
                  {renderAchievements()}
                </FadeInSection>
              </div>
            )}

            {/* ── Latest Steam News ── */}
            {newsData && newsData.news.length > 0 && (
              <FadeInSection>
                <section className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-accent" />
                    Latest News
                  </h3>
                  <div className="space-y-3">
                    {newsData.news.map((article: SteamNewsArticle) => (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-xl bg-surface-2 border border-border hover:border-accent/40 hover:bg-accent/5 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2">
                              {article.title}
                            </p>
                            <p className="text-xs text-tertiary mt-1 line-clamp-2">
                              {article.contents.replace(/<[^>]*>/g, "").replace(/\{[^}]*\}/g, "").substring(0, 150)}
                            </p>
                          </div>
                          <span className="text-xs text-tertiary group-hover:text-accent shrink-0 transition-colors">→</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-tertiary">
                          {article.feedLabel && (
                            <span className="bg-surface px-1.5 py-0.5 rounded-full border border-border">
                              {article.feedLabel}
                            </span>
                          )}
                          {article.author && <span>by {article.author}</span>}
                          <span>{formatDate(article.date)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              </FadeInSection>
            )}

          </div>

          {/* ─── RIGHT COLUMN (SIDEBAR) ─── */}
          <div className="order-2 lg:col-span-4 lg:row-span-2 space-y-6">
            <div className="lg:sticky space-y-6" style={{ top: "calc(var(--navbar-height, 56px) + 16px)" }}>

              {/* ── Add to Library ── */}
              {!isPreviewGame && (
                <FadeInSection>
                  <LibraryStatusSelector
                    gameId={game.id}
                    onAuthRequired={() => setAuthModalOpen(true)}
                  />
                </FadeInSection>
              )}

              {/* ── HLTB Data ── */}
              {(game.hltbMain || game.hltbExtras || game.hltbCompletionist) && (
                <FadeInSection>
                  <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
                      <Clock className="w-4 h-4 text-accent" /> How Long to Beat
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {game.hltbMain != null && (
                        <div className="rounded-xl bg-surface-2 border border-border p-3">
                          <p className="text-lg font-bold text-accent tabular-nums">{game.hltbMain}h</p>
                          <p className="text-[10px] text-tertiary uppercase tracking-wider">Main</p>
                        </div>
                      )}
                      {game.hltbExtras != null && (
                        <div className="rounded-xl bg-surface-2 border border-border p-3">
                          <p className="text-lg font-bold text-score-good tabular-nums">{game.hltbExtras}h</p>
                          <p className="text-[10px] text-tertiary uppercase tracking-wider">+ Extras</p>
                        </div>
                      )}
                      {game.hltbCompletionist != null && (
                        <div className="rounded-xl bg-surface-2 border border-border p-3">
                          <p className="text-lg font-bold text-score-great tabular-nums">{game.hltbCompletionist}h</p>
                          <p className="text-[10px] text-tertiary uppercase tracking-wider">100%</p>
                        </div>
                      )}
                    </div>
                  </section>
                </FadeInSection>
              )}

              {/* ── Where to Play ── */}
              <FadeInSection>
                {(game.steamUrl || game.playStoreUrl || game.appStoreUrl || game.websiteUrl || currentPrice) && (
                  <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                      Where to Play
                    </h3>
                    <div className="space-y-2.5">
                      {game.steamUrl && (
                        <a
                          href={game.steamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl border border-border bg-surface-2 text-foreground hover:border-accent hover:bg-accent/5 transition-all group w-full"
                        >
                          <Gamepad2 className="w-4 h-4 text-accent" />
                          <span className="flex-1">Steam</span>
                          <span className="text-xs text-tertiary group-hover:text-accent transition-colors">→</span>
                        </a>
                      )}
                      {game.playStoreUrl && (
                        <a
                          href={game.playStoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl border border-border bg-surface-2 text-foreground hover:border-success hover:bg-success/5 transition-all group w-full"
                        >
                          <Smartphone className="w-4 h-4 text-success" />
                          <span className="flex-1">Google Play</span>
                          <span className="text-xs text-tertiary group-hover:text-success transition-colors">→</span>
                        </a>
                      )}
                      {game.appStoreUrl && (
                        <a
                          href={game.appStoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl border border-border bg-surface-2 text-foreground hover:border-secondary hover:bg-elevated transition-all group w-full"
                        >
                          <Smartphone className="w-4 h-4 text-secondary" />
                          <span className="flex-1">App Store</span>
                          <span className="text-xs text-tertiary group-hover:text-secondary transition-colors">→</span>
                        </a>
                      )}
                      {game.priceDealUrl && (
                        <a
                          href={game.priceDealUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl border border-border bg-surface-2 text-foreground hover:border-warning hover:bg-warning/5 transition-all group w-full"
                        >
                          <Tag className="w-4 h-4 text-warning" />
                          <span className="flex-1">Best Deal</span>
                          <span className="text-xs text-tertiary group-hover:text-warning transition-colors">→</span>
                        </a>
                      )}
                      {game.websiteUrl && (
                        <a
                          href={game.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl border border-border bg-surface-2 text-foreground hover:border-secondary hover:bg-elevated transition-all group w-full"
                        >
                          <Globe className="w-4 h-4 text-secondary" />
                          <span className="flex-1">Official Site</span>
                          <span className="text-xs text-tertiary group-hover:text-secondary transition-colors">→</span>
                        </a>
                      )}
                    </div>

                    {/* Price info */}
                    {(currentPrice || lowestPrice) && (
                      <div className="pt-3 border-t border-border/50 space-y-1.5">
                        {currentPrice && (
                          <div className="flex justify-between text-sm">
                            <span className="text-tertiary">Current price</span>
                            <span className="font-bold text-accent">{currentPrice}</span>
                          </div>
                        )}
                        {lowestPrice && (
                          <div className="flex justify-between text-sm">
                            <span className="text-tertiary">All-time low</span>
                            <span className="font-semibold text-success">{lowestPrice}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </FadeInSection>

              {/* ── Game Details ── */}
              <FadeInSection>
                <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                    Details
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-tertiary pt-1">Developer</dt>
                      <dd className="text-right">
                        {developerName && developerHref ? (
                          <Link
                            href={developerHref}
                            prefetch={false}
                            className="group inline-flex flex-col items-end gap-1 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 transition-all hover:border-accent/40 hover:bg-accent/15 hover:shadow-[0_0_20px_-12px_rgba(34,211,238,0.55)]"
                            aria-label={`Open developer page for ${developerName}`}
                          >
                            <span className="inline-flex items-center gap-1.5 text-foreground font-semibold">
                              <Building2 className="w-3.5 h-3.5 text-accent" />
                              <span>{developerName}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                              Open developer page
                            </span>
                          </Link>
                        ) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-tertiary">Publisher</dt>
                      <dd className="text-foreground font-medium text-right">{game.publisher || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-tertiary">Released</dt>
                      <dd className="text-foreground font-medium">{formatDate(game.releaseDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-tertiary">Genres</dt>
                      <dd className="text-foreground font-medium text-right max-w-[60%]">{game.genres.join(", ") || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-tertiary">Monetization</dt>
                      <dd>
                        <PixelBadge
                          variant={game.monetization === "Paid" ? "success" : game.monetization === "Free" ? "accent" : "warning"}
                          size="sm"
                        >
                          {game.monetization}
                        </PixelBadge>
                      </dd>
                    </div>
                  </dl>
                </section>
              </FadeInSection>

              {/* ── Live Stats ── */}
              <FadeInSection>
                {(game.currentPlayers || game.reviewCount > 0 || game.userScore || game.igdbRating) && (
                  <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-accent" /> Live Stats
                    </h3>
                    <div className="space-y-3">
                      {game.score > 0 && (
                        <StatBar
                          value={game.score}
                          max={100}
                          label="Verdict Score"
                          color={game.score >= 80 ? "text-score-great" : game.score >= 65 ? "text-score-good" : game.score >= 45 ? "text-score-mixed" : "text-score-bad"}
                        />
                      )}
                      {game.userScore !== undefined && game.userScore > 0 && (
                        <StatBar
                          value={game.userScore}
                          max={100}
                          label="Community Score"
                          color={game.userScore >= 80 ? "text-score-great" : game.userScore >= 65 ? "text-score-good" : game.userScore >= 45 ? "text-score-mixed" : "text-score-bad"}
                        />
                      )}
                      {game.igdbRating !== undefined && game.igdbRating > 0 && (
                        <StatBar
                          value={game.igdbRating}
                          max={100}
                          label="Critic Score"
                          color={game.igdbRating >= 80 ? "text-score-great" : game.igdbRating >= 65 ? "text-score-good" : game.igdbRating >= 45 ? "text-score-mixed" : "text-score-bad"}
                        />
                      )}
                    </div>

                    {/* Player counts */}
                    {(game.currentPlayers !== undefined && game.currentPlayers > 0) && (
                      <div className="pt-3 border-t border-border/50">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-tertiary">{playerStatsLabel}</span>
                          <span className="text-lg font-bold text-accent tabular-nums">
                            {game.currentPlayers.toLocaleString()}
                          </span>
                        </div>
                        {playerStatsTimestampLabel && (
                          <p className="text-[10px] text-tertiary/60 mt-0.5">
                            {playerStatsTimestampLabel}
                          </p>
                        )}
                      </div>
                    )}
                    {game.reviewCount > 0 && (game.steamUrl || game.scoreSource === "steam" || game.steamRatingLabel) && (
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-xs text-tertiary">Steam Reviews</span>
                        <span className="font-bold text-foreground tabular-nums">
                          {game.reviewCount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </section>
                )}
              </FadeInSection>

              {/* ── External Links ── */}
              <FadeInSection>
                {(game.igdbUrl || game.wikipediaUrl || game.metacriticUrl || game.redditUrl) && (
                  <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                      More Info
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {game.igdbUrl && (
                        <a href={game.igdbUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-xl border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          IGDB
                        </a>
                      )}
                      {game.wikipediaUrl && (
                        <a href={game.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-xl border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          Wikipedia
                        </a>
                      )}
                      {game.metacriticUrl && (
                        <a href={game.metacriticUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-xl border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          Metacritic
                        </a>
                      )}
                      {game.redditUrl && (
                        <a href={game.redditUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-xl border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          Reddit
                        </a>
                      )}
                    </div>
                  </section>
                )}
              </FadeInSection>

              {/* ── Achievements (desktop only — mobile renders in main column) ── */}
              {achievementsData && achievementsData.achievements.length > 0 && (
                <div className="hidden lg:block">
                  <FadeInSection>
                    {renderAchievements()}
                  </FadeInSection>
                </div>
              )}
            </div>
          </div>

          {/* ─── MAIN CONTENT (REVIEWS & COMMENTS) ─── */}
          <div className="order-3 lg:col-span-8 space-y-8">

            {/* ── Player Thoughts ── */}
            {!isPreviewGame && (
              <FadeInSection>
                <section className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-accent" />
                    Player Thoughts
                  </h3>

                  {(game.reviewCount > 0 || game.userScore) && (game.steamUrl || game.scoreSource === "steam" || game.steamRatingLabel) && (
                    <div className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4 text-accent" />
                          <span className="text-sm font-semibold text-foreground">Steam Reviews</span>
                        </div>
                        {game.steamRatingLabel && (
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full border",
                            game.userScore && game.userScore >= 80
                              ? "bg-score-great/15 text-score-great border-score-great/25"
                              : game.userScore && game.userScore >= 70
                                ? "bg-score-good/15 text-score-good border-score-good/25"
                                : game.userScore && game.userScore >= 50
                                  ? "bg-score-mixed/15 text-score-mixed border-score-mixed/25"
                                  : "bg-score-bad/15 text-score-bad border-score-bad/25"
                          )}>
                            {game.steamRatingLabel}
                          </span>
                        )}
                      </div>

                      {game.userScore != null && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-secondary">
                              <span className="text-score-great font-semibold">{game.userScore}%</span> positive
                            </span>
                            <span className="text-tertiary">
                              {game.reviewCount.toLocaleString()} reviews
                            </span>
                          </div>
                          <div
                            className="steam-review-bar"
                            style={{ "--positive-pct": `${game.userScore}%` } as React.CSSProperties}
                          />
                          <div className="flex items-center justify-between text-[10px] text-tertiary">
                            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> ~{Math.round(game.reviewCount * (game.userScore / 100)).toLocaleString()} positive</span>
                            <span className="flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> ~{Math.round(game.reviewCount * ((100 - game.userScore) / 100)).toLocaleString()} negative</span>
                          </div>
                        </div>
                      )}

                      {game.steamUrl && (
                        <a
                          href={game.steamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center text-xs text-accent hover:text-accent-hover font-medium transition-colors pt-1"
                        >
                          View all reviews on Steam →
                        </a>
                      )}
                    </div>
                  )}

                  {isReviewsLoading ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider">
                        Verdict.games Community
                      </h4>
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-full" />
                              <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-40 rounded-lg" />
                                <Skeleton className="h-3 w-28 rounded-lg" />
                              </div>
                            </div>
                            <Skeleton className="h-4 w-full rounded-lg" />
                            <Skeleton className="h-4 w-5/6 rounded-lg" />
                            <Skeleton className="h-20 w-full rounded-xl" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : reviewsData?.items && reviewsData.items.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider">
                        Verdict.games Community
                      </h4>
                      {reviewsData.items.map((review) => (
                        <div key={review.id} className="space-y-2">
                          <ReviewCard
                            review={review}
                            showGame={false}
                            onAuthRequired={() => setAuthModalOpen(true)}
                          />
                          <CommentThread
                            reviewId={review.id}
                            onAuthRequired={() => setAuthModalOpen(true)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-surface-2 p-6 text-center space-y-2">
                      <p className="text-secondary text-sm font-medium">
                        Be the first to share your thoughts on Verdict.games!
                      </p>
                      <p className="text-tertiary text-xs">
                        Player thoughts from Verdict.games members will appear here.
                      </p>
                    </div>
                  )}

                  <ReviewForm
                    gameId={game.id}
                    gameSlug={slug}
                    onAuthRequired={() => setAuthModalOpen(true)}
                  />
                </section>
              </FadeInSection>
            )}

            {/* ── Steam Player Reviews ── */}
            {!isPreviewGame && (
              <FadeInSection>
                <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
                  <SteamReviews slug={slug} initialData={initialSteamReviewsData} />
                </section>
              </FadeInSection>
            )}
          </div>
        </div>

        {/* ═══════════════ FULL-WIDTH SECTIONS ═══════════════ */}

        {/* ── Related Games ── */}
        <FadeInSection>
          {related && related.length > 0 && (
            <section className="mt-12 pt-8 border-t border-border">
              <SectionHeader title="You Might Also Like" icon={<Target className="w-5 h-5" />} />
              <GameGrid games={related} columns={4} />
            </section>
          )}
        </FadeInSection>

        {/* ── Attribution ── */}
        <FadeInSection>
          <div className="text-[10px] text-tertiary border-t border-border pt-4 mt-8 space-y-1">
            <p>
              Data sourced from RAWG, Steam, IGDB, CheapShark, Wikipedia, HLTB, and GX Corner.
              {game.enrichmentSources && game.enrichmentSources.length > 0 && (
                <> Sources: {game.enrichmentSources.join(", ")}.</>
              )}
            </p>
            <p>
              All game titles, trademarks, and copyrights belong to their respective owners.
            </p>
          </div>
        </FadeInSection>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
