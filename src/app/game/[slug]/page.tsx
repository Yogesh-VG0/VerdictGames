"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getGameBySlug, getGameReviews, getRelatedGames } from "@/lib/api";
import { formatDate, scoreColor, cn } from "@/lib/utils";
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

interface Props {
  params: Promise<{ slug: string }>;
}

/** Format cents to a dollar string like "$29.99" */
function formatPrice(cents: number | undefined, currency = "USD"): string | null {
  if (cents === undefined || cents === null) return null;
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function scoreGlowClass(score: number) {
  if (score >= 80) return "score-glow-great";
  if (score >= 65) return "score-glow-good";
  if (score >= 45) return "score-glow-mixed";
  return "score-glow-bad";
}

/** Format a timestamp to "Xh ago" / "Xm ago" / "Xd ago" */
function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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

export default function GameDetailPage({ params }: Props) {
  const { slug } = use(params);

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", slug],
    queryFn: () => getGameBySlug(slug),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ["gameReviews", slug],
    queryFn: () => getGameReviews(slug, { sort: "helpful" }),
    enabled: !!game,
  });

  const { data: related } = useQuery({
    queryKey: ["relatedGames", slug],
    queryFn: () => getRelatedGames(slug),
    enabled: !!game,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <Skeleton className="aspect-[21/9] w-full rounded-sm" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-2 rounded-sm" />
          <Skeleton className="h-64 rounded-sm" />
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
        <Link href="/">
          <PixelButton variant="secondary">Back to Home</PixelButton>
        </Link>
      </div>
    );
  }

  const currentPrice = formatPrice(game.priceCurrent, game.priceCurrency);
  const lowestPrice = formatPrice(game.priceLowest, game.priceCurrency);
  const sc = scoreColor(game.score);

  return (
    <div className="space-y-0">
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative">
        <div className="relative h-[50vh] md:h-[60vh] min-h-[320px] max-h-[600px] overflow-hidden">
          <Image
            src={game.headerImage}
            alt={game.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          {/* Multi-layer gradients for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
          <div className="absolute inset-0 hero-spotlight" />
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
                  <PixelBadge key={p} variant={p === "PC" ? "accent" : "success"} size="md">
                    {p}
                  </PixelBadge>
                ))}
                {game.isFree && (
                  <PixelBadge variant="success" size="md">Free to Play</PixelBadge>
                )}
                {game.releaseDate && (
                  <span className="text-xs text-secondary font-medium ml-1">
                    {formatDate(game.releaseDate)}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] max-w-3xl">
                {game.title}
              </h1>
              {game.subtitle && (
                <p className="text-sm md:text-base text-secondary max-w-2xl">{game.subtitle}</p>
              )}

              {/* Quick info chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-tertiary">
                {game.developer && (
                  <span className="bg-surface/60 backdrop-blur-sm px-2.5 py-1 rounded-sm border border-border/50">
                    {game.developer}
                  </span>
                )}
                {game.genres.slice(0, 3).map((g) => (
                  <span key={g} className="bg-surface/60 backdrop-blur-sm px-2.5 py-1 rounded-sm border border-border/50">
                    {g}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ─── LEFT COLUMN (Main Content) ─── */}
          <div className="lg:col-span-8 space-y-8">

            {/* ── Verdict Card ── */}
            <FadeInSection>
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="rounded-sm border border-border bg-surface overflow-hidden"
              >
                {/* Score header band */}
                <div className="relative p-5 md:p-6 mesh-gradient">
                  <div className="flex items-start gap-5 md:gap-6">
                    <div className={cn("shrink-0 rounded-sm", scoreGlowClass(game.score))}>
                      <ScoreRing score={game.score} size={88} strokeWidth={5} className="relative" />
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
                    <p className="text-[9px] text-tertiary text-center">
                      Verdict score derived from {game.scoreSource === "steam" ? "Steam reviews" : game.scoreSource === "igdb" ? "IGDB rating" : game.scoreSource === "metacritic" ? "Metacritic" : "RAWG/IGDB signals"}
                    </p>
                  </div>
                </div>

                {/* Pros & Cons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
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
            </FadeInSection>

            {/* ── Overview / Description ── */}
            <FadeInSection>
              <section className="rounded-sm border border-border bg-surface p-5 md:p-6 space-y-4">
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
                        className="text-[10px] text-tertiary bg-surface-2 px-2 py-1 rounded-sm border border-border/50 hover:border-accent/30 hover:text-accent transition-colors cursor-default"
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
                <section className="rounded-sm border border-border bg-surface p-5 md:p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                    Media
                  </h3>

                  {/* Trailer */}
                  {game.trailerUrl && (
                    <a
                      href={game.trailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-video rounded-sm overflow-hidden border border-border group"
                    >
                      <Image
                        src={game.trailerThumbnail || game.screenshots[0] || game.headerImage}
                        alt={`${game.title} trailer`}
                        fill
                        sizes="(max-width: 768px) 100vw, 700px"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="w-16 h-16 rounded-full bg-accent/90 flex items-center justify-center shadow-lg shadow-accent/30"
                        >
                          <span className="text-white text-2xl ml-1">▶</span>
                        </motion.div>
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <span className="text-xs text-white/80 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-sm">
                          Watch Trailer
                        </span>
                      </div>
                    </a>
                  )}

                  {/* Screenshots carousel */}
                  {game.screenshots.length > 0 && (
                    <MediaCarousel images={game.screenshots} alt={game.title} />
                  )}
                </section>
              )}
            </FadeInSection>

            {/* ── Performance & Monetization ── */}
            <FadeInSection>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <section className="rounded-sm border border-border bg-surface p-5 space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">⚡</span> Performance
                  </h3>
                  <p className="text-secondary text-sm leading-relaxed">
                    {game.performanceNotes || (
                      game.platforms.includes("PC")
                        ? "Runs well on modern hardware. Check Steam page for system requirements."
                        : "Optimized for mobile devices. Performance varies by device."
                    )}
                  </p>
                </section>
                <section className="rounded-sm border border-border bg-surface p-5 space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">💳</span> Monetization
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <PixelBadge
                      variant={
                        game.monetization === "Paid"
                          ? "success"
                          : game.monetization === "Free"
                            ? "accent"
                            : "warning"
                      }
                    >
                      {game.monetization}
                    </PixelBadge>
                    {currentPrice && <span className="text-xs text-tertiary">({currentPrice})</span>}
                  </div>
                  <p className="text-secondary text-sm leading-relaxed">
                    {game.monetizationNotes || (
                      game.isFree
                        ? "Free to play. May include optional in-game purchases."
                        : game.monetization === "Paid"
                          ? "One-time purchase — full game included."
                          : "Check the store page for in-app details."
                    )}
                  </p>
                </section>
              </div>
            </FadeInSection>

            {/* ── Community Reviews ── */}
            <FadeInSection>
              <section className="rounded-sm border border-border bg-surface p-5 md:p-6 space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
                  <span className="text-base">💬</span>
                  Community Reviews
                  {game.reviewCount > 0 && (
                    <span className="text-tertiary font-normal normal-case tracking-normal ml-1">
                      ({game.reviewCount.toLocaleString()} Steam reviews)
                    </span>
                  )}
                </h3>
                {reviewsData?.items && reviewsData.items.length > 0 ? (
                  <div className="space-y-3">
                    {reviewsData.items.map((review) => (
                      <ReviewCard key={review.id} review={review} showGame={false} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <div className="text-4xl">🎮</div>
                    <p className="text-secondary text-sm">
                      No community reviews yet on Verdict.games.
                    </p>
                    <p className="text-tertiary text-xs">
                      Be the first to share your verdict!
                    </p>
                  </div>
                )}
              </section>
            </FadeInSection>
          </div>

          {/* ─── RIGHT COLUMN (Sidebar) ─── */}
          <div className="lg:col-span-4 space-y-6">
            <div className="lg:sticky lg:top-20 space-y-6">

              {/* ── Where to Play ── */}
              <FadeInSection>
                {(game.steamUrl || game.playStoreUrl || currentPrice) && (
                  <section className="rounded-sm border border-border bg-surface p-5 space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                      Where to Play
                    </h3>
                    <div className="space-y-2.5">
                      {game.steamUrl && (
                        <a
                          href={game.steamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-accent hover:bg-accent/5 transition-all group w-full"
                        >
                          <span className="text-lg">🎮</span>
                          <span className="flex-1">Steam</span>
                          <span className="text-xs text-tertiary group-hover:text-accent transition-colors">→</span>
                        </a>
                      )}
                      {game.playStoreUrl && (
                        <a
                          href={game.playStoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-success hover:bg-success/5 transition-all group w-full"
                        >
                          <span className="text-lg">📱</span>
                          <span className="flex-1">Google Play</span>
                          <span className="text-xs text-tertiary group-hover:text-success transition-colors">→</span>
                        </a>
                      )}
                      {game.priceDealUrl && (
                        <a
                          href={game.priceDealUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-warning hover:bg-warning/5 transition-all group w-full"
                        >
                          <span className="text-lg">💰</span>
                          <span className="flex-1">Best Deal</span>
                          <span className="text-xs text-tertiary group-hover:text-warning transition-colors">→</span>
                        </a>
                      )}
                      {game.websiteUrl && (
                        <a
                          href={game.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-secondary hover:bg-border/20 transition-all group w-full"
                        >
                          <span className="text-lg">🌐</span>
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
                <section className="rounded-sm border border-border bg-surface p-5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                    Details
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-tertiary">Developer</dt>
                      <dd className="text-foreground font-medium text-right">{game.developer || "—"}</dd>
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
                  <section className="rounded-sm border border-border bg-surface p-5 space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line flex items-center gap-2">
                      <span className="text-base">📊</span> Live Stats
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
                          <span className="text-xs text-tertiary">Playing Now</span>
                          <span className="text-lg font-bold text-accent tabular-nums">
                            {game.currentPlayers.toLocaleString()}
                          </span>
                        </div>
                        {game.playersUpdatedAt && (
                          <p className="text-[10px] text-tertiary/60 mt-0.5">
                            Updated {formatTimeAgo(game.playersUpdatedAt)}
                          </p>
                        )}
                      </div>
                    )}
                    {game.reviewCount > 0 && (
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
                  <section className="rounded-sm border border-border bg-surface p-5 space-y-3">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider section-title-line">
                      More Info
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {game.igdbUrl && (
                        <a href={game.igdbUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          IGDB
                        </a>
                      )}
                      {game.wikipediaUrl && (
                        <a href={game.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          Wikipedia
                        </a>
                      )}
                      {game.metacriticUrl && (
                        <a href={game.metacriticUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          Metacritic
                        </a>
                      )}
                      {game.redditUrl && (
                        <a href={game.redditUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent text-center transition-colors">
                          Reddit
                        </a>
                      )}
                    </div>
                  </section>
                )}
              </FadeInSection>
            </div>
          </div>
        </div>

        {/* ═══════════════ FULL-WIDTH SECTIONS ═══════════════ */}

        {/* ── Related Games ── */}
        <FadeInSection>
          {related && related.length > 0 && (
            <section className="mt-12 pt-8 border-t border-border">
              <SectionHeader title="You Might Also Like" icon="🎯" />
              <GameGrid games={related} columns={4} />
            </section>
          )}
        </FadeInSection>

        {/* ── Attribution ── */}
        <FadeInSection>
          <div className="text-[10px] text-tertiary border-t border-border/50 pt-4 mt-8 space-y-1">
            <p>
              Data sourced from RAWG, Steam, IGDB, CheapShark, and Wikipedia.
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
    </div>
  );
}
