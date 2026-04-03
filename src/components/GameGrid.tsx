"use client";

import { Game } from "@/lib/types";
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

  return (
    <div className={cn("grid gap-4", colMap[columns], className)}>
      {games.map((game, i) => (
        <GameCard key={game.id} game={game} priority={i < columns} />
      ))}
    </div>
  );
}
