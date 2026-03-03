"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Game } from "@/lib/types";
import VerdictBadge from "@/components/ui/VerdictBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";

interface FeaturedHeroProps {
  game: Game;
}

export default function FeaturedHero({ game }: FeaturedHeroProps) {
  return (
    <section className="relative rounded-sm overflow-hidden border border-border scanlines group">
      {/* Background image */}
      <div className="relative aspect-[16/9] sm:aspect-[16/9] md:aspect-[21/9]">
        <Image
          src={game.headerImage}
          alt={game.title}
          fill
          sizes="100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          priority
        />

        {/* Multi-layer gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
        <div className="absolute inset-0 hero-spotlight opacity-60" />
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
          className="text-2xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight max-w-2xl"
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
          {game.platforms.map((p) => (
            <PixelBadge key={p} variant={p === "PC" ? "muted" : "success"} size="md">
              {p}
            </PixelBadge>
          ))}
          {game.releaseDate && (
            <span className="text-xs text-tertiary font-medium">
              {new Date(game.releaseDate).getFullYear()}
            </span>
          )}
        </motion.div>

        {/* Summary */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-sm md:text-base text-secondary max-w-2xl line-clamp-2"
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
          <Link href={`/game/${game.slug}`}>
            <PixelButton size="md">Read Verdict</PixelButton>
          </Link>
        </motion.div>
      </div>

      {/* Subtle animated border accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
    </section>
  );
}
