"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Game } from "@/lib/types";
import { scoreColor, cn } from "@/lib/utils";
import PixelBadge from "@/components/ui/PixelBadge";
import VerdictBadge from "@/components/ui/VerdictBadge";

interface GameCardProps {
  game: Game;
  priority?: boolean;
  className?: string;
}

export default function GameCard({
  game,
  priority = false,
  className,
}: GameCardProps) {
  return (
    <Link href={`/game/${game.slug}`} className={cn("block group", className)}>
      <motion.article
        whileHover={{ y: -6, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative rounded-sm border border-border bg-surface overflow-hidden pixel-corners h-full hover:border-border-hover hover:shadow-lg hover:shadow-accent/5 transition-[border-color,box-shadow] duration-300"
      >
        {/* Cover image */}
        <div className="relative aspect-[5/7] overflow-hidden">
          <Image
            src={game.coverImage}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />

          {/* Score overlay */}
          <div
            className={cn(
              "absolute top-2 right-2 w-9 h-9 rounded-sm flex items-center justify-center",
              "bg-background/80 backdrop-blur-sm border border-border text-xs font-bold tabular-nums",
              scoreColor(game.score)
            )}
          >
            {game.score}
          </div>

          {/* Platform badges */}
          <div className="absolute bottom-2 left-2 flex gap-1">
            {game.platforms.map((p) => (
              <PixelBadge
                key={p}
                variant={p === "PC" ? "accent" : "success"}
                size="sm"
              >
                {p}
              </PixelBadge>
            ))}
          </div>
        </div>

        {/* Card body */}
        <div className="p-3 space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
            {game.title}
          </h3>

          <div className="flex items-center gap-2">
            <VerdictBadge label={game.verdictLabel} size="sm" />
          </div>

          <div className="flex flex-wrap gap-1 pt-0.5">
            {game.genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="text-[10px] text-tertiary font-medium uppercase tracking-wide"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
