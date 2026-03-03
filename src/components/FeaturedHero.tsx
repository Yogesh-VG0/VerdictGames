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
    <section className="relative rounded-sm overflow-hidden border border-border scanlines hover:border-border-hover transition-colors duration-300">
      {/* Background image */}
      <div className="relative aspect-[16/9] sm:aspect-[16/9] md:aspect-[21/9]">
        <Image
          src={game.headerImage}
          alt={game.title}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 space-y-3">
        {/* Featured label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <PixelBadge variant="accent" size="sm">
            ★ Featured
          </PixelBadge>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl md:text-4xl font-bold text-foreground leading-tight"
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
    </section>
  );
}
