import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import GameCard from "@/components/GameCard";
import ReviewCard from "@/components/ReviewCard";
import { games, reviews } from "@/data/mockData";

const SearchPage = () => {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return { games: [], reviews: [] };
    const q = query.toLowerCase();
    return {
      games: games.filter((g) => g.title.toLowerCase().includes(q) || g.genres.some((genre) => genre.toLowerCase().includes(q))),
      reviews: reviews.filter((r) => r.gameTitle.toLowerCase().includes(q) || r.excerpt.toLowerCase().includes(q)),
    };
  }, [query]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-pixel text-lg text-primary mb-6 glow-gold">Search</h1>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games, reviews, genres..."
          className="w-full pixel-border-gold bg-muted px-6 py-4 text-lg text-foreground placeholder:text-muted-foreground outline-none mb-8"
          autoFocus
        />

        {query.trim() && (
          <>
            {results.games.length > 0 && (
              <section className="mb-10">
                <h2 className="font-pixel text-xs text-foreground mb-4">Games ({results.games.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {results.games.slice(0, 8).map((game) => (
                    <GameCard key={game.slug} game={game} />
                  ))}
                </div>
              </section>
            )}
            {results.reviews.length > 0 && (
              <section>
                <h2 className="font-pixel text-xs text-foreground mb-4">Reviews ({results.reviews.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              </section>
            )}
            {results.games.length === 0 && results.reviews.length === 0 && (
              <p className="text-muted-foreground text-center py-12">No results found for "{query}"</p>
            )}
          </>
        )}

        {!query.trim() && (
          <p className="text-muted-foreground text-center py-12 text-sm">Start typing to search our database of games and reviews.</p>
        )}
      </div>
    </Layout>
  );
};

export default SearchPage;
