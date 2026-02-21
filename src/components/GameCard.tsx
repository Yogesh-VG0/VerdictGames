import { Link } from "react-router-dom";
import type { Game } from "@/data/mockData";

const GameCard = ({ game }: { game: Game }) => (
  <Link to={`/games/${game.slug}`} className="block pixel-card p-0 overflow-hidden group">
    <div className="relative aspect-[4/3] overflow-hidden">
      <img
        src={game.cover}
        alt={game.title}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {/* Rating badge */}
      <div className="absolute bottom-2 right-2 rating-badge">
        {game.score.toFixed(1)}
      </div>
      {/* Favorite icon */}
      <div className="absolute top-2 right-2 text-lg opacity-0 group-hover:opacity-100 transition-opacity">
        ❤️
      </div>
    </div>
    <div className="p-3">
      <h3 className="font-pixel text-[10px] text-foreground mb-2 leading-relaxed truncate">
        {game.title}
      </h3>
      <div className="flex gap-1.5 flex-wrap">
        {game.platforms.map((p) => (
          <span key={p} className={`platform-pill ${p === "PC" ? "platform-pill-pc" : "platform-pill-android"}`}>
            {p}
          </span>
        ))}
      </div>
    </div>
  </Link>
);

export default GameCard;
