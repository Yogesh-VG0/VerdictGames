"use client";

import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import type { GameCardData } from "@/lib/types";
import { scoreColor, cn, sourceLabel, scoreGlowClass, getStableYear } from "@/lib/utils";
import { collapsePlatforms } from "@/lib/utils/platform";
import VerdictBadge from "@/components/ui/VerdictBadge";
import PlatformIcon from "@/components/ui/PlatformIcon";
import SafeImage from "@/components/ui/SafeImage";
import { OrientedCardImage } from "@/components/CatalogueCardArtwork";
import { artworkKind, catalogueGameHref } from "@/lib/utils/artwork";

type RenderedGameCard = Omit<GameCardData, "verdictSummary"> & Partial<Pick<GameCardData, "verdictSummary">>;

interface GameCardProps {
  game: RenderedGameCard;
  priority?: boolean;
  prefetch?: boolean;
  className?: string;
  variant?: "default" | "spotlight";
}

function yearFromGame(game: RenderedGameCard): string | null {
  return game.releaseTiming ? game.releaseTiming.precision === 'tba' ? null : game.releaseTiming.value.slice(0, 4)
    : getStableYear(game.releaseDate);
}

function isUnreleased(game: RenderedGameCard): boolean {
  return game.isProvisional || game.verdictLabel === "COMING SOON";
}

const momentumDateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

function TrendingEvidence({ game }: { game: RenderedGameCard }) {
  if (!game.trendingReason) return null;
  const observed = game.trendingReason === "Past Momentum" ? Date.parse(game.playersUpdatedAt ?? "") : NaN;
  return (
    <span className="block text-[9px] font-bold text-white bg-black/75 px-2 py-0.5 rounded-lg border border-white/20 whitespace-nowrap">
      {game.trendingReason}
      {Number.isFinite(observed) && <time dateTime={game.playersUpdatedAt}> · {momentumDateFormat.format(observed)}</time>}
    </span>
  );
}

function hasRealScore(game: RenderedGameCard): boolean {
  if (isUnreleased(game)) return false;
  if (game.score === 0 && game.scoreSource === "gx") return false;
  if (game.verdictLabel === "JUST RELEASED") return false;
  if (game.verdictLabel === "COMING SOON") return false;
  return game.score > 0;
}

function scoreGlowBorder(score: number): string {
  if (score >= 80) return "hover:shadow-[0_0_20px_-8px_rgba(74,222,128,0.15)]";
  if (score >= 65) return "hover:shadow-[0_0_20px_-8px_rgba(163,230,53,0.15)]";
  if (score >= 45) return "hover:shadow-[0_0_20px_-8px_rgba(250,204,21,0.15)]";
  return "hover:shadow-[0_0_20px_-8px_rgba(248,113,113,0.15)]";
}

function BlurImage({ src, alt, sizes, priority, className }: {
  src: string; alt: string; sizes?: string; priority?: boolean; className?: string;
}) {
  sizes ??= "(max-width: 640px) 44vw, (max-width: 768px) 208px, (max-width: 1024px) 224px, 240px";
  if (artworkKind(src) === 'artwork') return <OrientedCardImage image={src} alt={alt} layout="portrait" sizes={sizes} priority={priority} />;
  return (
    <>
      <div
        className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface-2 to-pixel-cyan/10 flex items-center justify-center"
      >
        <Gamepad2 className="w-7 h-7 text-accent/30" />
      </div>
      <SafeImage
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={75}
        className={cn(
          "object-cover transition-transform duration-300",
          className
        )}
        fallback={<Gamepad2 className="w-7 h-7 text-accent/30" />}
        fallbackClassName="flex items-center justify-center bg-surface-2"
      />
    </>
  );
}

export default function GameCard({
  game,
  priority = false,
  prefetch = false,
  className,
  variant = "default",
}: GameCardProps) {
  const href = catalogueGameHref({ slug: game.slug, rawgId: game.rawgId ?? 0, catalogueId: game.isPreview ? undefined : game.id });
  const ratingLabel = game.isPreview ? sourceLabel(game.scoreSource) || 'Provider' : 'Verdict';
  const ratingTitle = game.isPreview
    ? `${ratingLabel} rating: ${game.score}`
    : `Verdict score: ${game.score}. Provider ratings are separate; this score accounts for review confidence.`;
  if (variant === "spotlight") {
    return (
      <Link href={href} prefetch={prefetch} className={cn("block group rounded-2xl focus-visible:outline-2 focus-visible:outline-accent", className)}>
        <article
          className={cn(
            "relative rounded-2xl border border-border bg-surface overflow-hidden signal-card h-full hover:border-border-hover",
            hasRealScore(game) ? scoreGlowBorder(game.score) : "hover:shadow-[0_0_20px_-8px_rgba(168,85,247,0.12)]"
          )}
        >
          <div className="relative aspect-[3/4] overflow-hidden">
            {game.coverImage ? (
              <BlurImage
                key={game.coverImage}
                src={game.coverImage}
                alt={game.title}
                sizes="(max-width: 640px) 88vw, (max-width: 1024px) 320px, 360px"
                className="object-cover motion-safe:group-hover:scale-[1.03]"
                priority={priority}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface-2 to-pixel-cyan/10 flex items-center justify-center">
                <Gamepad2 className="w-8 h-8 text-accent/35" />
              </div>
            )}
            <div className="absolute inset-0 card-image-gradient" />
            {hasRealScore(game) ? (
              <div
                className={cn(
                  "absolute top-3 right-3 rounded-xl px-2.5 py-1 flex items-center gap-1.5",
                  "hero-score-palette bg-[#050509] border border-white/15 text-lg font-bold tabular-nums",
                  scoreColor(game.score),
                  "group-hover:" + scoreGlowClass(game.score),
                  "transition-colors duration-150"
                )}
                title={ratingTitle}
              >
                {game.score}
                <span className="text-[10px] text-white/80 font-medium uppercase">{ratingLabel}</span>
              </div>
            ) : isUnreleased(game) ? (
              <div className="absolute top-3 right-3 rounded-xl px-2.5 py-1 bg-accent/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
                {game.verdictLabel === 'CANCELLED' ? 'Cancelled' : game.releaseStatus === 'early-access' ? 'Early Access' : game.releaseDateTba ? 'Date TBA' : 'Coming Soon'}
              </div>
            ) : game.verdictLabel === "JUST RELEASED" ? (
              <div className="absolute top-3 right-3 rounded-xl px-2.5 py-1 bg-pixel-cyan/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
                Just Released
              </div>
              ) : null}

              {game.trendingReason && (
                <div className="absolute bottom-3 right-3 z-[1]">
                  <TrendingEvidence game={game} />
                </div>
              )}
            </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2 z-[1]">
            {(() => {
              const { visible, overflow } = collapsePlatforms(game.platforms, 3);
              return (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {visible.map((p) => (
                    <PlatformIcon key={p} platform={p} size={14} className="drop-shadow-md brightness-0 invert opacity-80" />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[9px] text-white/40">+{overflow}</span>
                  )}
                  {yearFromGame(game) && (
                    <span className="text-[10px] text-white/50 font-medium ml-auto">
                      {yearFromGame(game)}
                    </span>
                  )}
                </div>
              );
            })()}
            <h3 className="text-base font-bold text-white leading-tight line-clamp-2 group-hover:text-accent transition-colors drop-shadow-md">
              {game.title}
            </h3>
            {(hasRealScore(game) || game.verdictLabel === 'NOT YET RATED') && <VerdictBadge label={game.verdictLabel} size="sm" />}
            {hasRealScore(game) && game.confidence != null && game.confidence < 0.3 && <p className="text-[10px] text-white/70">Limited rating evidence</p>}
            {game.verdictSummary && (
              <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                {game.verdictSummary}
              </p>
            )}
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} className={cn("block group rounded-2xl focus-visible:outline-2 focus-visible:outline-accent", className)}>
      <article
        className={cn(
          "relative rounded-2xl border border-border bg-surface overflow-hidden signal-card h-full hover:border-border-hover",
          hasRealScore(game) ? scoreGlowBorder(game.score) : "hover:shadow-[0_0_20px_-8px_rgba(168,85,247,0.1)]"
        )}
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          {game.coverImage ? (
            <BlurImage
              key={game.coverImage}
              src={game.coverImage}
              alt={game.title}
              sizes="(max-width: 640px) 44vw, (max-width: 768px) 208px, (max-width: 1024px) 224px, 240px"
              className="object-cover motion-safe:group-hover:scale-[1.03]"
              priority={priority}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface-2 to-pixel-cyan/10 flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-accent/35" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

          {hasRealScore(game) && (
            <div
              className={cn(
                "absolute top-2.5 right-2.5 rounded-xl px-2 py-1 flex items-center gap-1",
                "hero-score-palette bg-[#050509] border border-white/15 text-base font-bold tabular-nums",
                scoreColor(game.score),
                "transition-colors duration-150"
              )}
              title={ratingTitle}
            >
              {game.score}
              <span className="text-[10px] text-white/80 font-medium uppercase">{ratingLabel}</span>
            </div>
          )}
          {isUnreleased(game) && (
            <div className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 bg-accent/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
              {game.verdictLabel === 'CANCELLED' ? 'Cancelled' : game.releaseStatus === 'early-access' ? 'Early Access' : game.releaseDateTba ? 'Date TBA' : 'Coming Soon'}
            </div>
          )}
          {!isUnreleased(game) && game.verdictLabel === "JUST RELEASED" && (
            <div className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 bg-pixel-cyan/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white">
              Just Released
            </div>
          )}

          {(() => {
            const { visible, overflow } = collapsePlatforms(game.platforms, 3);
            return (
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                {visible.map((p) => (
                  <PlatformIcon key={p} platform={p} size={14} className="drop-shadow-md brightness-0 invert opacity-80" />
                ))}
                {overflow > 0 && (
                  <span className="text-[9px] text-white/50 font-medium">+{overflow}</span>
                )}
              </div>
            );
          })()}

          {yearFromGame(game) && (
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[10px] text-white/70 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-lg font-medium border border-white/5">
                {yearFromGame(game)}
              </span>
            </div>
          )}

          {game.trendingReason && (
            <div className="absolute bottom-2.5 right-2.5 z-[1]">
              <TrendingEvidence game={game} />
            </div>
          )}
        </div>

        <div className="p-3.5 space-y-2">
          <h3 className="min-h-10 break-words text-sm font-semibold leading-5 text-foreground line-clamp-2 group-hover:text-accent transition-colors">
            {game.title}
          </h3>

          <div className="min-h-[20px]">
            {(hasRealScore(game) || game.verdictLabel === 'NOT YET RATED') && <VerdictBadge label={game.verdictLabel} size="sm" />}
            {hasRealScore(game) && game.confidence != null && game.confidence < 0.3 && <p className="text-[10px] text-tertiary mt-1">Limited rating evidence</p>}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-tertiary font-medium min-h-[16px]">
            {game.genres.length > 0 ? game.genres.slice(0, 2).map((g, i) => (
              <span key={g}>
                {i > 0 && <span className="mx-0.5 opacity-40">&middot;</span>}
                {g}
              </span>
            )) : <span className="opacity-0">—</span>}
          </div>
        </div>
      </article>
    </Link>
  );
}
