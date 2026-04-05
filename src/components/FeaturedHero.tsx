"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Game } from "@/lib/types";
import { getStableYear } from "@/lib/utils";
import VerdictBadge from "@/components/ui/VerdictBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";
import PlatformIcon from "@/components/ui/PlatformIcon";
import HeroImage from "@/components/ui/HeroImage";

interface FeaturedHeroProps {
  game: Game;
}

export default function FeaturedHero({ game }: FeaturedHeroProps) {
  return (
    <section className="relative rounded-sm overflow-hidden border border-border scanlines group">
      {/* Background image */}
      <div className="relative aspect-[16/9] sm:aspect-[16/9] md:aspect-[21/9]">
        {game.headerImage ? (
          <HeroImage
            src={game.headerImage}
            alt={game.title}
            className="transition-transform duration-700 group-hover:scale-[1.02]"
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/20 via-surface to-pixel-cyan/10 flex items-center justify-center">
            <span className="text-7xl opacity-30">🎮</span>
          </div>
        )}

        {/* Multi-layer gradient overlays — always dark */}
        <div className="absolute inset-0 hero-gradient-bottom" />
        <div className="absolute inset-0 hero-gradient-right" />
        <div className="absolute inset-0 hero-gradient-vignette opacity-60" />
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 space-y-3">
        {/* Featured label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pixel-pulse" />
            Featured
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl md:text-4xl lg:text-5xl font-bold hero-overlay-text leading-tight max-w-2xl drop-shadow-lg"
        >
          {game.title}
        </motion.h1>

        {/* Score + Verdict + Platform */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3 flex-wrap"
        >
          <ScoreRing score={game.score} size={56} strokeWidth={3} className="relative" />
          <VerdictBadge label={game.verdictLabel} size="lg" />
          {game.platforms.slice(0, 4).map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/15 text-xs font-medium text-white/90">
              <PlatformIcon platform={p} size={14} />
            </span>
          ))}
          {game.releaseDate && (
            <span className="text-xs text-tertiary font-medium">
              {getStableYear(game.releaseDate)}
            </span>
          )}
        </motion.div>

        {/* Summary */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-sm md:text-base hero-overlay-text-secondary max-w-2xl line-clamp-2"
        >
          {game.verdictSummary}
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3 pt-1"
        >
          <Link href={`/game/${game.slug}`} prefetch={false}>
            <PixelButton as="span" size="md">Read Verdict</PixelButton>
          </Link>
        </motion.div>
      </div>

      {/* Subtle animated border accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
    </section>
  );
}
