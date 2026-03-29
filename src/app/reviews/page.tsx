"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getGlobalReviews, getTopRated, getSteamReviews, searchGames, getAllEditorialReviews } from "@/lib/api";
import type { EditorialReviewWithGame } from "@/lib/api";
import type { SteamPlayerReview } from "@/lib/api";
import ReviewCard from "@/components/ReviewCard";
import FilterChips from "@/components/ui/FilterChips";
import SortDropdown from "@/components/ui/SortDropdown";
import { ReviewCardSkeleton } from "@/components/ui/Skeleton";
import type { Platform } from "@/lib/types";
import { PLATFORM_FILTER_OPTIONS, platformFilterIcon } from "@/components/ui/PlatformIcon";
import { PenLine, Star, ThumbsUp, ThumbsDown, Search, MessageSquare, ChevronLeft, ChevronRight, PenSquare } from "lucide-react";
import GradientText from "@/components/ui/GradientText";
import Image from "next/image";
import { slugify } from "@/lib/utils/slugify";
import { cn } from "@/lib/utils";

const listItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

function formatPlaytime(minutes: number): string {
  const hours = Math.round(minutes / 60);
  if (hours < 1) return "<1 hr";
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}K hrs`;
  return `${hours} hrs`;
}

function SteamReviewCard({ review }: { review: SteamPlayerReview }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      review.votedUp ? "border-pixel-green/20 bg-pixel-green/[0.03]" : "border-red-500/20 bg-red-500/[0.03]"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {review.votedUp
            ? <ThumbsUp className="w-4 h-4 text-pixel-green" />
            : <ThumbsDown className="w-4 h-4 text-red-400" />}
          <span className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            review.votedUp ? "text-pixel-green" : "text-red-400"
          )}>
            {review.votedUp ? "Recommended" : "Not Recommended"}
          </span>
        </div>
        <span className="text-[10px] text-tertiary">{formatPlaytime(review.playtimeAtReview)} at review</span>
      </div>
      <p className="text-sm text-secondary leading-relaxed line-clamp-6 min-h-[8.5rem]">{review.reviewText}</p>
      <div className="flex items-center gap-3 text-[10px] text-tertiary">
        {review.votesUp > 0 && <span>{review.votesUp} found helpful</span>}
        {review.authoredAt && (
          <span>{new Date(review.authoredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        )}
        {review.steamPurchase && <span className="text-pixel-cyan/70">Steam Purchase</span>}
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const [source, setSource] = useState<"editorial" | "community" | "steam">("editorial");
  const [sort, setSort] = useState<"newest" | "helpful">("newest");
  const [platform, setPlatform] = useState<"All" | Platform>("All");
  const [steamGameQuery, setSteamGameQuery] = useState("");
  const [steamGameSlug, setSteamGameSlug] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSteamQuery, setDebouncedSteamQuery] = useState("");
  const [steamReviewPage, setSteamReviewPage] = useState(1);
  const STEAM_REVIEWS_PER_PAGE = 5;

  // Debounce steam game query for suggestions
   
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSteamQuery(steamGameQuery), 300);
    return () => clearTimeout(timer);
  }, [steamGameQuery]);

  const suggestionsQuery = useQuery({
    queryKey: ["gameSuggestions", debouncedSteamQuery],
    queryFn: () => searchGames({ query: debouncedSteamQuery, page: 1 }),
    enabled: debouncedSteamQuery.length >= 2 && showSuggestions,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["globalReviews", sort, platform],
    queryFn: () =>
      getGlobalReviews({
        sort,
        platform: platform === "All" ? "All" : platform,
      }),
  });

  const { data: topGames } = useQuery({
    queryKey: ["topRatedPicks"],
    queryFn: () => getTopRated(6),
    enabled: !isLoading && (!data || data.items.length === 0),
    staleTime: 60_000,
  });

  const steamReviewsQuery = useQuery({
    queryKey: ["steamReviewsPage", steamGameSlug],
    queryFn: () => getSteamReviews(steamGameSlug!, 20),
    enabled: !!steamGameSlug,
    staleTime: 30 * 60 * 1000,
  });

  const editorialQuery = useQuery({
    queryKey: ["allEditorialReviews"],
    queryFn: () => getAllEditorialReviews(1),
    enabled: source === "editorial",
    staleTime: 60 * 60 * 1000,
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-rose-500" />
          <GradientText text="Reviews" gradient="linear-gradient(90deg, #f43f5e 0%, #e879f9 25%, #c084fc 50%, #e879f9 75%, #f43f5e 100%)" />
        </h1>
        <p className="text-sm text-secondary">
          Editorial verdicts, player thoughts, and Steam reviews.
        </p>
      </motion.div>

      {/* Source tabs */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <button
          onClick={() => setSource("editorial")}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shrink-0",
            source === "editorial"
              ? "bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-400 border border-amber-500/30"
              : "bg-surface-2 text-secondary hover:text-foreground border border-border"
          )}
        >
          <PenSquare className="w-3.5 h-3.5" />
          Verdict Reviews
        </button>
        <button
          onClick={() => setSource("community")}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0",
            source === "community"
              ? "bg-accent text-white shadow-sm shadow-accent/20"
              : "bg-surface-2 text-secondary hover:text-foreground border border-border"
          )}
        >
          Player Thoughts
        </button>
        <button
          onClick={() => setSource("steam")}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
            source === "steam"
              ? "bg-pixel-cyan/20 text-pixel-cyan border border-pixel-cyan/30"
              : "bg-surface-2 text-secondary hover:text-foreground border border-border"
          )}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Steam Player Reviews
        </button>
      </div>

      {/* Editorial tab content */}
      {source === "editorial" && (
        <div className="space-y-4">
          <p className="text-xs text-tertiary">
            In-depth reviews from Verdict.games editors. Our team plays and evaluates games to give you honest, detailed verdicts.
          </p>
          {editorialQuery.isLoading && (
            <div className="grid grid-cols-1 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-4 h-40 animate-pulse" />
              ))}
            </div>
          )}
          {!editorialQuery.isLoading && editorialQuery.data && editorialQuery.data.reviews.length > 0 && (
            <motion.div
              className="grid grid-cols-1 gap-4"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {editorialQuery.data.reviews.map((review) => (
                <motion.div key={review.id} variants={listItem}>
                  <Link
                    href={`/game/${review.games.slug}`}
                    className="block rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-5 hover:border-accent/40 transition-all group"
                  >
                    <div className="flex gap-4">
                      {/* Game Cover */}
                      <div className="w-16 h-20 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
                        {review.games.cover_image ? (
                          <Image
                            src={review.games.cover_image}
                            alt={review.games.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-tertiary text-xs">?</div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1">
                              {review.games.title}
                            </h3>
                            <p className="text-xs text-tertiary">
                              {review.games.developer} • {review.games.release_date?.split("-")[0]}
                            </p>
                          </div>
                          {review.is_featured && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0">
                              <Star className="w-3 h-3" />
                              Featured
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        {review.title && (
                          <p className="text-sm font-medium text-foreground">{review.title}</p>
                        )}

                        {/* Content preview */}
                        <p className="text-sm text-secondary line-clamp-2">
                          {review.content.slice(0, 200)}...
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-3 text-[10px] text-tertiary">
                          <span className="flex items-center gap-1">
                            <PenSquare className="w-3 h-3 text-accent" />
                            {review.profiles.display_name || review.profiles.username}
                          </span>
                          {review.playtime_hours && <span>{review.playtime_hours}h played</span>}
                          {review.platform_played && <span>on {review.platform_played}</span>}
                          {review.published_at && (
                            <span>{new Date(review.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
          {!editorialQuery.isLoading && (!editorialQuery.data || editorialQuery.data.reviews.length === 0) && (
            <div className="rounded-xl border border-dashed border-border bg-surface-2 p-8 text-center space-y-2">
              <PenSquare className="w-8 h-8 text-tertiary mx-auto" />
              <p className="text-secondary text-sm font-medium">No editorial reviews yet</p>
              <p className="text-tertiary text-xs">Check back soon for in-depth game reviews from our editors.</p>
            </div>
          )}
        </div>
      )}

      {/* Steam tab content */}
      {source === "steam" && (
        <div className="space-y-4">
          <p className="text-xs text-tertiary">
            Browse official Steam player reviews. These are separate from Verdict.games player thoughts and sourced directly from Valve&apos;s Steam API.
          </p>
          {/* Game search */}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const q = steamGameQuery.trim();
              if (q) { setSteamGameSlug(slugify(q)); setSteamReviewPage(1); }
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
              <input
                type="text"
                value={steamGameQuery}
                onChange={(e) => { setSteamGameQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Enter a game title e.g. Elden Ring…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-surface-2 text-foreground placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
              />
              {/* Suggestions dropdown */}
              {showSuggestions && suggestionsQuery.data && suggestionsQuery.data.items.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border bg-surface shadow-xl max-h-48 overflow-y-auto">
                  {suggestionsQuery.data.items.slice(0, 6).map((game) => (
                    <button
                      key={game.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSteamGameQuery(game.title);
                        setSteamGameSlug(game.slug);
                        setSteamReviewPage(1);
                        setShowSuggestions(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2 transition-colors text-sm"
                    >
                      {game.coverImage && (
                        <Image src={game.coverImage} alt="" width={24} height={32} className="rounded object-cover shrink-0" />
                      )}
                      <span className="text-foreground truncate">{game.title}</span>
                      {game.score > 0 && (
                        <span className="ml-auto text-[10px] text-tertiary shrink-0">{game.score}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 text-sm font-medium rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              Search
            </button>
          </form>

          {steamGameSlug && (
            <div className="space-y-3">
              {steamReviewsQuery.isLoading && (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface-2 p-4 h-28 animate-pulse" />
                ))
              )}
              {!steamReviewsQuery.isLoading && steamReviewsQuery.data && steamReviewsQuery.data.reviews.length > 0 && (
                <>
                  {/* Game identity header */}
                  <div className="rounded-xl border border-border bg-surface-2 p-4">
                    <div className="flex items-center gap-4">
                      {steamReviewsQuery.data.coverImage && (
                        <Link href={`/game/${steamGameSlug}`} className="relative w-16 h-20 rounded-lg overflow-hidden shrink-0 group">
                          <Image
                            src={steamReviewsQuery.data.coverImage}
                            alt={steamReviewsQuery.data.gameTitle ?? "Game"}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="64px"
                          />
                        </Link>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/game/${steamGameSlug}`}
                          className="text-sm font-semibold text-foreground hover:text-accent transition-colors truncate block"
                        >
                          {steamReviewsQuery.data.gameTitle ?? steamGameQuery}
                        </Link>
                        <p className="text-[10px] text-tertiary mt-1">
                          Showing top {steamReviewsQuery.data.reviews.length} of {steamReviewsQuery.data.total} Steam reviews
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <Link
                            href={`/game/${steamGameSlug}`}
                            className="text-[10px] text-accent hover:text-accent-hover font-medium"
                          >
                            View on Verdict.games →
                          </Link>
                          {steamReviewsQuery.data.steamAppId && (
                            <a
                              href={`https://store.steampowered.com/app/${steamReviewsQuery.data.steamAppId}#app_reviews_hash`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-pixel-cyan hover:underline font-medium"
                            >
                              View all on Steam →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {steamReviewsQuery.data.reviews.slice(
                    (steamReviewPage - 1) * STEAM_REVIEWS_PER_PAGE,
                    steamReviewPage * STEAM_REVIEWS_PER_PAGE
                  ).map((r) => (
                    <SteamReviewCard key={r.recommendationId} review={r} />
                  ))}

                  {/* Numbered pagination */}
                  {(() => {
                    const totalPages = Math.ceil(steamReviewsQuery.data.reviews.length / STEAM_REVIEWS_PER_PAGE);
                    if (totalPages <= 1) return null;
                    const getPages = () => {
                      const pages: (number | "...")[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (steamReviewPage > 3) pages.push("...");
                        for (let i = Math.max(2, steamReviewPage - 1); i <= Math.min(totalPages - 1, steamReviewPage + 1); i++) pages.push(i);
                        if (steamReviewPage < totalPages - 2) pages.push("...");
                        pages.push(totalPages);
                      }
                      return pages;
                    };
                    return (
                      <div className="flex items-center justify-center gap-1.5 pt-2">
                        <button
                          onClick={() => setSteamReviewPage((p) => Math.max(1, p - 1))}
                          disabled={steamReviewPage === 1}
                          className="p-1.5 rounded-lg border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        {getPages().map((pg, i) =>
                          pg === "..." ? (
                            <span key={`steam-ellipsis-${i}`} className="px-1 text-[11px] text-tertiary">…</span>
                          ) : (
                            <button
                              key={pg}
                              onClick={() => setSteamReviewPage(pg)}
                              className={cn(
                                "min-w-[28px] h-7 rounded-lg text-[11px] font-medium transition-colors",
                                pg === steamReviewPage
                                  ? "bg-accent text-white"
                                  : "text-secondary hover:text-foreground hover:bg-surface-2 border border-border"
                              )}
                            >
                              {pg}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => setSteamReviewPage((p) => Math.min(totalPages, p + 1))}
                          disabled={steamReviewPage === totalPages}
                          className="p-1.5 rounded-lg border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}

                  <p className="text-[10px] text-tertiary pt-1">
                    Reviews sourced from Steam via the official Valve API. All reviews belong to their respective authors.
                  </p>
                </>
              )}
              {!steamReviewsQuery.isLoading && steamReviewsQuery.data && steamReviewsQuery.data.reviews.length === 0 && (
                <div className="text-center py-8 text-secondary text-sm">
                  {steamReviewsQuery.data.message === "No Steam App ID"
                    ? "This game isn\'t available on Steam or wasn\'t found in our database."
                    : "No Steam reviews found for this game yet."}
                </div>
              )}
            </div>
          )}

          {!steamGameSlug && (
            <div className="text-center py-10 rounded-xl border border-dashed border-border text-secondary text-sm">
              Search for a game above to see its Steam player reviews.
            </div>
          )}
        </div>
      )}

      {/* Community tab content */}
      {source === "community" && (
        <>
      {/* Filters */}
      <div className="space-y-4 border-b border-border pb-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium block">
            Platform
          </label>
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <FilterChips
              options={PLATFORM_FILTER_OPTIONS.map((o) => o.value)}
              selected={platform}
              onChange={setPlatform}
              labelFn={(v) => PLATFORM_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? v}
              iconFn={(v) => platformFilterIcon(v)}
            />
          </div>
        </div>
        <div className="flex items-end gap-4">
          <div className="space-y-2 ml-auto">
            <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium">
              Sort
            </label>
            <SortDropdown
              options={[
                { label: "Newest First", value: "newest" as const },
                { label: "Most Helpful", value: "helpful" as const },
              ]}
              selected={sort}
              onChange={setSort}
            />
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="space-y-4 max-w-4xl"
      >
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))
        ) : data && data.items.length > 0 ? (
          data.items.map((review) => (
            <motion.div key={review.id} variants={listItem}>
              <ReviewCard review={review} />
            </motion.div>
          ))
        ) : (
          <div className="space-y-8">
            {/* Enhanced empty state */}
            <div className="text-center py-10 space-y-4 rounded-2xl border border-border bg-surface">
              <PenLine className="w-10 h-10 text-accent mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Be the First to Share Your Verdict</h2>
              <p className="text-sm text-secondary max-w-lg mx-auto leading-relaxed">
                Our community reviews section is brand new. Your review could be the first one others read when deciding what to play next.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <Link
                  href="/search?sort=trending"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
                >
                  Review a Trending Game
                </Link>
                <Link
                  href="/search?sort=top-rated"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-accent border border-accent/30 rounded-xl hover:bg-accent/10 transition-colors"
                >
                  Browse Top Rated
                </Link>
              </div>
            </div>

            {/* Dynamic top-rated games as review suggestions */}
            {topGames && topGames.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-4 h-4 text-accent" />
                  Top Rated — Games Worth Reviewing
                </h3>
                <p className="text-xs text-tertiary">
                  These highly-rated games are waiting for community verdicts. Pick one and share your thoughts!
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {topGames.map((game) => (
                    <Link
                      key={game.slug}
                      href={`/game/${game.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-accent/30 hover:bg-surface-2 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold shrink-0 ${
                        game.score >= 90 ? "bg-score-great/10 text-score-great" : "bg-score-good/10 text-score-good"
                      }`}>
                        {game.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                          {game.title}
                        </p>
                        <p className="text-[10px] text-tertiary">{game.genres?.[0] ?? ""}</p>
                      </div>
                      <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Review →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
      </>
      )}
    </div>
  );
}
