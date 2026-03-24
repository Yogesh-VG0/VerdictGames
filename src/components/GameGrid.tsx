"use client";

import { Game } from "@/lib/types";
import { motion } from "framer-motion";
import GameCard from "./GameCard";
import { cn } from "@/lib/utils";

interface GameGridProps {
  games: Game[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

const colMap = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
};

export default function GameGrid({
  games,
  columns = 4,
  className,
}: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary text-sm">No games found.</p>
      </div>
    );
  }

  /* Animate on mount only — not whileInView — so "Load more" rows are visible immediately below the fold */
  return (
    <div className={cn("grid gap-4", colMap[columns], className)}>
      {games.map((game, i) => (
        <motion.div
          key={game.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: Math.min(i * 0.04, 0.48) }}
        >
          <GameCard game={game} priority={i < 4} />
        </motion.div>
      ))}
    </div>
  );
}
