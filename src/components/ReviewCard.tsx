import { Link } from "react-router-dom";
import type { Review } from "@/data/mockData";

const ReviewCard = ({ review }: { review: Review }) => (
  <Link to={`/games/${review.gameSlug}`} className="block pixel-card p-0 overflow-hidden group">
    <div className="flex gap-0">
      <div className="w-24 md:w-32 flex-shrink-0">
        <img
          src={review.gameCover}
          alt={review.gameTitle}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-pixel text-[10px] text-foreground truncate">{review.gameTitle}</h3>
          <span className="rating-badge text-[10px] flex-shrink-0">{review.score}</span>
        </div>
        <span className={`platform-pill ${review.platform === "PC" ? "platform-pill-pc" : "platform-pill-android"} mb-2 inline-block`}>
          {review.platform}
        </span>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{review.excerpt}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-pixel-cyan">{review.author}</span>
          <span className="text-[10px] text-muted-foreground">{review.date}</span>
        </div>
      </div>
    </div>
  </Link>
);

export default ReviewCard;
