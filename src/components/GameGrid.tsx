"use client";

import { Game } from "@/lib/types";
import { motion } from "framer-motion";
import GameCard from "./GameCard";
import { cn } from "@/lib/utils";

interface GameGridProps {
  games: Game[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const colMap = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
};

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
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

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      className={cn("grid gap-4", colMap[columns], className)}
    >
      {games.map((game, i) => (
        <motion.div key={game.id} variants={item}>
          <GameCard game={game} priority={i < 4} />
        </motion.div>
      ))}
    </motion.div>
  );
}
