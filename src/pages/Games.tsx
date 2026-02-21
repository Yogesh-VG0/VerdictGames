import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import GameCard from "@/components/GameCard";
import { games, genres } from "@/data/mockData";

const GamesPage = ({ preselectedPlatform }: { preselectedPlatform?: "PC" | "Android" }) => {
  const [platform, setPlatform] = useState<"" | "PC" | "Android">(preselectedPlatform || "");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState<"score" | "date" | "title">("score");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const filtered = useMemo(() => {
    let list = [...games];
    if (platform) list = list.filter((g) => g.platforms.includes(platform));
    if (genre) list = list.filter((g) => g.genres.includes(genre));
    if (search) list = list.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()));
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    else if (sort === "date") list.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
    else list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [platform, genre, sort, search]);

  const pageTitle = preselectedPlatform ? `${preselectedPlatform} Games` : "Browse Games";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-pixel text-lg text-primary mb-2 glow-gold">{pageTitle}</h1>
        <p className="text-muted-foreground text-sm mb-8">
          {preselectedPlatform
            ? `Discover the best ${preselectedPlatform} games with honest verdicts.`
            : "Browse our complete game database with filters and ratings."}
        </p>

        {/* Platform focus block */}
        {preselectedPlatform && (
          <div className="pixel-border-cyan p-4 mb-8">
            <h2 className="font-pixel text-[10px] text-pixel-cyan mb-2">
              {preselectedPlatform === "PC" ? "🖥️ PC Testing Focus" : "📱 Android Testing Focus"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {preselectedPlatform === "PC"
                ? "We test every PC game with recommended specs, noting frame rates, settings impact, and hardware requirements so you know exactly what to expect."
                : "Every Android game is tested across device tiers — we measure FPS stability, battery drain, heat generation, and touch control quality."}
            </p>
          </div>
        )}

        {/* Search + filter toggle */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games..."
            className="flex-1 pixel-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <button onClick={() => setShowFilters(!showFilters)} className="pixel-btn-secondary text-[10px] py-2 px-4 md:hidden">
            Filters
          </button>
        </div>

        <div className="flex gap-6">
          {/* Filters sidebar */}
          <aside className={`${showFilters ? "block" : "hidden"} md:block w-full md:w-56 flex-shrink-0 space-y-4`}>
            {!preselectedPlatform && (
              <div className="pixel-card p-3">
                <h3 className="font-pixel text-[8px] text-foreground mb-2 uppercase">Platform</h3>
                {["", "PC", "Android"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p as any)}
                    className={`block w-full text-left text-xs py-1.5 px-2 transition-colors ${
                      platform === p ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p || "All Platforms"}
                  </button>
                ))}
              </div>
            )}

            <div className="pixel-card p-3">
              <h3 className="font-pixel text-[8px] text-foreground mb-2 uppercase">Genre</h3>
              <button
                onClick={() => setGenre("")}
                className={`block w-full text-left text-xs py-1 px-2 ${!genre ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                All Genres
              </button>
              {genres.slice(0, 12).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={`block w-full text-left text-xs py-1 px-2 transition-colors ${
                    genre === g ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="pixel-card p-3">
              <h3 className="font-pixel text-[8px] text-foreground mb-2 uppercase">Sort By</h3>
              {([["score", "Top Rated"], ["date", "Newest"], ["title", "A–Z"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSort(val)}
                  className={`block w-full text-left text-xs py-1.5 px-2 transition-colors ${
                    sort === val ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </aside>

          {/* Game grid */}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-4">{filtered.length} games found</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.slice(0, visibleCount).map((game) => (
                <GameCard key={game.slug} game={game} />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div className="text-center mt-8">
                <button onClick={() => setVisibleCount((c) => c + 12)} className="pixel-btn text-[10px]">
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GamesPage;
