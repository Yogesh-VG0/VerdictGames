"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* ── Hero Section ── */}
      <section className="relative rounded-sm overflow-hidden border border-border">
        <div className="relative aspect-[16/9] md:aspect-[21/9]">
          <Image
            src={game.headerImage}
            alt={game.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {game.platforms.map((p) => (
              <PixelBadge key={p} variant={p === "PC" ? "accent" : "success"} size="sm">
                {p}
              </PixelBadge>
            ))}
            {game.isFree && (
              <PixelBadge variant="success" size="sm">Free to Play</PixelBadge>
            )}
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground">
            {game.title}
          </h1>
          {game.subtitle && (
            <p className="text-sm text-secondary">{game.subtitle}</p>
          )}
        </div>
      </section>

      {/* ── TL;DR Verdict Card ── */}
      <FadeInSection>
      <section className="rounded-sm border border-border bg-surface p-5 md:p-6 pixel-corners space-y-4">
        <div className="flex items-start gap-4 md:gap-6">
          <ScoreRing score={game.score} size={80} strokeWidth={5} className="relative shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <VerdictBadge label={game.verdictLabel} size="lg" />
              {game.userScore !== undefined && (
                <span className="text-xs text-tertiary">
                  Community: <span className={cn("font-bold", scoreColor(game.userScore))}>{game.userScore}</span>
                </span>
              )}
              {game.igdbRating !== undefined && (
                <span className="text-xs text-tertiary">
                  Critics: <span className={cn("font-bold", scoreColor(game.igdbRating))}>{game.igdbRating}</span>
                </span>
              )}
            </div>
            <p className="text-sm text-secondary leading-relaxed">
              {game.verdictSummary}
            </p>
          </div>
        </div>

        {/* Pros & Cons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-success uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-success rounded-full" />
              What works
            </h4>
            {game.pros.map((pro, i) => (
              <p key={i} className="text-sm text-secondary pl-3 border-l-2 border-success/20">
                {pro}
              </p>
            ))}
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-danger uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-danger rounded-full" />
              What doesn&apos;t
            </h4>
            {game.cons.map((con, i) => (
              <p key={i} className="text-sm text-secondary pl-3 border-l-2 border-danger/20">
                {con}
              </p>
            ))}
          </div>
        </div>
      </section>
      </FadeInSection>

      {/* ── Where to Play + Price ── */}
      <FadeInSection>
      {(game.steamUrl || game.playStoreUrl || currentPrice) && (
        <section className="rounded-sm border border-border bg-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Where to Play
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            {game.steamUrl && (
              <a
                href={game.steamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-accent hover:text-accent transition-colors"
              >
                🎮 Steam
              </a>
            )}
            {game.playStoreUrl && (
              <a
                href={game.playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-success hover:text-success transition-colors"
              >
                📱 Google Play
              </a>
            )}
            {game.priceDealUrl && (
              <a
                href={game.priceDealUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-warning hover:text-warning transition-colors"
              >
                💰 Best Deal
              </a>
            )}
            {game.websiteUrl && (
              <a
                href={game.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border border-border bg-surface-2 text-foreground hover:border-secondary hover:text-secondary transition-colors"
              >
                🌐 Official Site
              </a>
            )}
          </div>

          {/* Price info */}
          {(currentPrice || lowestPrice) && (
            <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
              {currentPrice && (
                <span className="text-foreground">
                  Current: <span className="font-bold text-accent">{currentPrice}</span>
                </span>
              )}
              {lowestPrice && (
                <span className="text-tertiary">
                  All-time low: <span className="font-semibold text-success">{lowestPrice}</span>
                </span>
              )}
            </div>
          )}
        </section>
      )}
      </FadeInSection>

      {/* ── Overview / Description ── */}
      <FadeInSection>
      <section className="rounded-sm border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Overview</h3>
        <p className="text-secondary text-sm leading-relaxed">{game.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
          <div>
            <span className="text-tertiary text-xs uppercase tracking-wider block">Developer</span>
            <p className="text-foreground font-medium">{game.developer || "—"}</p>
          </div>
          <div>
            <span className="text-tertiary text-xs uppercase tracking-wider block">Publisher</span>
            <p className="text-foreground font-medium">{game.publisher || "—"}</p>
          </div>
          <div>
            <span className="text-tertiary text-xs uppercase tracking-wider block">Release Date</span>
            <p className="text-foreground font-medium">{formatDate(game.releaseDate)}</p>
          </div>
          <div>
            <span className="text-tertiary text-xs uppercase tracking-wider block">Genres</span>
            <p className="text-foreground font-medium">{game.genres.join(", ") || "—"}</p>
          </div>
        </div>

        {/* Tags */}
        {game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {game.tags.map((tag) => (
              <PixelBadge key={tag} variant="muted" size="sm">
                {tag}
              </PixelBadge>
            ))}
          </div>
        )}
      </section>
      </FadeInSection>

      {/* ── Live Stats ── */}
      <FadeInSection>
      {(game.currentPlayers || game.reviewCount > 0) && (
        <section className="rounded-sm border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Live Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {game.currentPlayers !== undefined && game.currentPlayers > 0 && (
              <div className="space-y-1">
                <p className="text-2xl font-bold text-accent">{game.currentPlayers.toLocaleString()}</p>
                <p className="text-xs text-tertiary">Playing Now</p>
              </div>
            )}
            {game.reviewCount > 0 && (
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{game.reviewCount.toLocaleString()}</p>
                <p className="text-xs text-tertiary">Steam Reviews</p>
              </div>
            )}
            {game.userScore !== undefined && (
              <div className="space-y-1">
                <p className={cn("text-2xl font-bold", scoreColor(game.userScore))}>{game.userScore}%</p>
                <p className="text-xs text-tertiary">Positive</p>
              </div>
            )}
            {game.igdbRating !== undefined && (
              <div className="space-y-1">
                <p className={cn("text-2xl font-bold", scoreColor(game.igdbRating))}>{game.igdbRating}</p>
                <p className="text-xs text-tertiary">Critic Score</p>
              </div>
            )}
          </div>
        </section>
      )}
      </FadeInSection>

      {/* ── Performance & Monetization ── */}
      <FadeInSection>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-sm border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Performance</h3>
          <p className="text-secondary text-sm leading-relaxed">
            {game.performanceNotes || (
              game.platforms.includes("PC")
                ? "Runs well on modern hardware. Check Steam page for minimum and recommended system requirements."
                : "Optimized for mobile devices. Performance varies by device."
            )}
          </p>
        </section>
        <section className="rounded-sm border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Monetization</h3>
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
                  : "Check the store page for details on in-app purchases."
            )}
          </p>
        </section>
      </div>
      </FadeInSection>

      {/* ── Media ── */}
      <FadeInSection>
      {(game.screenshots.length > 0 || game.trailerUrl) && (
        <section className="rounded-sm border border-border bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Media</h3>

          {/* Trailer */}
          {game.trailerUrl && (
            <div className="space-y-2">
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
                  sizes="(max-width: 768px) 100vw, 800px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-accent/90 flex items-center justify-center">
                    <span className="text-white text-2xl ml-1">▶</span>
                  </div>
                </div>
              </a>
              <p className="text-xs text-tertiary text-center">Watch trailer on YouTube</p>
            </div>
          )}

          {/* Screenshots carousel */}
          {game.screenshots.length > 0 && (
            <MediaCarousel images={game.screenshots} alt={game.title} />
          )}
        </section>
      )}
      </FadeInSection>

      {/* ── External Links ── */}
      <FadeInSection>
      {(game.igdbUrl || game.wikipediaUrl || game.metacriticUrl || game.redditUrl) && (
        <section className="rounded-sm border border-border bg-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">More Info</h3>
          <div className="flex flex-wrap gap-2">
            {game.igdbUrl && (
              <a href={game.igdbUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent transition-colors">
                IGDB
              </a>
            )}
            {game.wikipediaUrl && (
              <a href={game.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent transition-colors">
                Wikipedia
              </a>
            )}
            {game.metacriticUrl && (
              <a href={game.metacriticUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent transition-colors">
                Metacritic
              </a>
            )}
            {game.redditUrl && (
              <a href={game.redditUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium rounded-sm border border-border bg-surface-2 text-secondary hover:text-accent hover:border-accent transition-colors">
                Reddit
              </a>
            )}
          </div>
        </section>
      )}
      </FadeInSection>

      {/* ── Community Reviews ── */}
      <FadeInSection>
      <section className="rounded-sm border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Community Reviews {game.reviewCount > 0 && `(${game.reviewCount.toLocaleString()} Steam reviews)`}
        </h3>
        {reviewsData?.items && reviewsData.items.length > 0 ? (
          reviewsData.items.map((review) => (
            <ReviewCard key={review.id} review={review} showGame={false} />
          ))
        ) : (
          <div className="text-center py-6 space-y-2">
            <p className="text-4xl">💬</p>
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

      {/* ── Related Games ── */}
      <FadeInSection>
      {related && related.length > 0 && (
        <section>
          <SectionHeader title="You Might Also Like" />
          <GameGrid games={related} columns={4} />
        </section>
      )}
      </FadeInSection>

      {/* ── Data Sources Attribution ── */}
      <FadeInSection>
      <div className="text-xs text-tertiary border-t border-border pt-4 space-y-1">
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
  );
}
