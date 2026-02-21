import { useState } from "react";
import Layout from "@/components/Layout";
import { games, genres } from "@/data/mockData";

const SubmitPage = () => {
  const [gameSearch, setGameSearch] = useState("");
  const [platform, setPlatform] = useState<"PC" | "Android">("PC");
  const [score, setScore] = useState(7);
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [review, setReview] = useState("");
  const [perfNotes, setPerfNotes] = useState("");

  const filteredGames = gameSearch
    ? games.filter((g) => g.title.toLowerCase().includes(gameSearch.toLowerCase())).slice(0, 5)
    : [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="font-pixel text-lg text-primary mb-2 glow-gold">Submit a Review</h1>
        <p className="text-muted-foreground text-sm mb-8">Share your verdict with the community.</p>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Game search */}
          <div>
            <label className="font-pixel text-[10px] text-foreground block mb-2">Game</label>
            <input
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              placeholder="Search for a game..."
              className="w-full pixel-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
            {filteredGames.length > 0 && (
              <div className="pixel-border bg-card mt-1">
                {filteredGames.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setGameSearch(g.title)}
                    className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    {g.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Platform */}
          <div>
            <label className="font-pixel text-[10px] text-foreground block mb-2">Platform</label>
            <div className="flex gap-3">
              {(["PC", "Android"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={platform === p ? "pixel-btn text-[10px]" : "pixel-btn-secondary text-[10px]"}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Score */}
          <div>
            <label className="font-pixel text-[10px] text-foreground block mb-2">
              Score: <span className="text-primary">{score}</span>/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={score}
              onChange={(e) => setScore(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Pros */}
          <div>
            <label className="font-pixel text-[10px] text-foreground block mb-2">Pros (one per line)</label>
            <textarea
              value={pros}
              onChange={(e) => setPros(e.target.value)}
              rows={3}
              placeholder="Great gameplay&#10;Beautiful graphics"
              className="w-full pixel-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Cons */}
          <div>
            <label className="font-pixel text-[10px] text-foreground block mb-2">Cons (one per line)</label>
            <textarea
              value={cons}
              onChange={(e) => setCons(e.target.value)}
              rows={3}
              placeholder="Short campaign&#10;Microtransactions"
              className="w-full pixel-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Review */}
          <div>
            <label className="font-pixel text-[10px] text-foreground block mb-2">Review</label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={6}
              placeholder="Write your review here..."
              className="w-full pixel-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Performance notes */}
          <div>
            <label className="font-pixel text-[10px] text-foreground block mb-2">
              Performance Notes ({platform})
            </label>
            <textarea
              value={perfNotes}
              onChange={(e) => setPerfNotes(e.target.value)}
              rows={3}
              placeholder={platform === "PC" ? "GPU, FPS, settings used..." : "Device model, FPS, battery drain..."}
              className="w-full pixel-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
            />
          </div>

          <button type="submit" className="pixel-btn w-full">
            Submit Review
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default SubmitPage;
