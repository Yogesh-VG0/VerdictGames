import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import Layout from "@/components/Layout";
import { games, reviews, comments } from "@/data/mockData";

const verdictColors: Record<string, string> = {
  "Must Play": "text-pixel-green",
  "Worth It": "text-pixel-cyan",
  "Wait for Sale": "text-pixel-gold",
  Skip: "text-destructive",
};

const GameDetail = () => {
  const { slug } = useParams();
  const game = games.find((g) => g.slug === slug);
  const [activeTab, setActiveTab] = useState<"review" | "performance" | "screenshots" | "community">("review");

  if (!game) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-pixel text-lg text-foreground mb-4">Game Not Found</h1>
          <Link to="/games" className="pixel-btn text-[10px]">Browse Games</Link>
        </div>
      </Layout>
    );
  }

  const gameComments = comments.filter((c) => c.gameSlug === slug);
  const gameReviews = reviews.filter((r) => r.gameSlug === slug);

  const tabs = ["review", "performance", "screenshots", "community"] as const;

  return (
    <Layout>
      {/* Hero header */}
      <section className="relative">
        <div className="h-64 md:h-80 overflow-hidden">
          <img src={game.cover} alt={game.title} className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        <div className="container mx-auto px-4 -mt-32 relative z-10">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-40 md:w-52 flex-shrink-0 pixel-border-gold overflow-hidden">
              <img src={game.cover} alt={game.title} className="w-full aspect-[3/4] object-cover" />
            </div>
            <div className="flex-1 pt-4 md:pt-16">
              <div className="flex gap-2 mb-2">
                {game.platforms.map((p) => (
                  <span key={p} className={`platform-pill ${p === "PC" ? "platform-pill-pc" : "platform-pill-android"}`}>{p}</span>
                ))}
              </div>
              <h1 className="font-pixel text-xl md:text-2xl text-foreground mb-3">{game.title}</h1>
              {/* Breadcrumb */}
              <nav className="text-xs text-muted-foreground mb-4">
                <Link to="/" className="hover:text-primary">Home</Link>
                <span className="mx-2">/</span>
                <Link to="/games" className="hover:text-primary">Games</Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">{game.title}</span>
              </nav>
              {/* Quick facts */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span>📅 {game.releaseDate}</span>
                <span>🏢 {game.developer}</span>
                <span>📦 {game.publisher}</span>
                <span>🏷️ {game.genres.join(", ")}</span>
                <span>💰 {game.price}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Verdict box */}
        <div className="pixel-border-gold p-6 mb-8 max-w-2xl">
          <div className="flex items-center gap-6 mb-4">
            <div className="text-center">
              <div className="font-pixel text-3xl text-primary glow-gold">{game.score}</div>
              <div className="font-pixel text-[8px] text-muted-foreground mt-1">/ 10</div>
            </div>
            <div>
              <div className={`font-pixel text-sm ${verdictColors[game.verdict]} mb-2`}>{game.verdict}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{game.summary}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {game.tags.map((tag) => (
              <span key={tag} className="text-[10px] text-pixel-purple pixel-border px-2 py-0.5">{tag}</span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b-3 border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-pixel text-[10px] uppercase px-4 py-3 border-b-3 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "review" && (
          <div className="max-w-3xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="pixel-card p-4">
                <h3 className="font-pixel text-[10px] text-pixel-green mb-3">✅ Pros</h3>
                <ul className="space-y-2">
                  {game.pros.map((pro) => (
                    <li key={pro} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-pixel-green">+</span> {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pixel-card p-4">
                <h3 className="font-pixel text-[10px] text-destructive mb-3">❌ Cons</h3>
                <ul className="space-y-2">
                  {game.cons.map((con) => (
                    <li key={con} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-destructive">−</span> {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="pixel-card p-4">
              <h3 className="font-pixel text-[10px] text-foreground mb-3">Best For</h3>
              <div className="flex gap-2 flex-wrap">
                {game.bestFor.map((tag) => (
                  <span key={tag} className="pixel-border px-3 py-1 text-xs text-pixel-cyan">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "performance" && (
          <div className="max-w-3xl space-y-6">
            {game.pcSpecs && (
              <div className="pixel-card p-4">
                <h3 className="font-pixel text-[10px] text-pixel-cyan mb-3">🖥️ PC Performance</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">Minimum:</strong> {game.pcSpecs.min}</p>
                  <p><strong className="text-foreground">Recommended:</strong> {game.pcSpecs.recommended}</p>
                  <p><strong className="text-foreground">Notes:</strong> {game.pcSpecs.settingsNote}</p>
                </div>
              </div>
            )}
            {game.androidPerf && (
              <div className="pixel-card p-4">
                <h3 className="font-pixel text-[10px] text-pixel-green mb-3">📱 Android Performance</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">Device Tier:</strong> {game.androidPerf.tier}</p>
                  <p><strong className="text-foreground">FPS:</strong> {game.androidPerf.fps}</p>
                  <p><strong className="text-foreground">Battery:</strong> {game.androidPerf.battery}</p>
                  <p><strong className="text-foreground">Heat:</strong> {game.androidPerf.heat}</p>
                </div>
              </div>
            )}
            {!game.pcSpecs && !game.androidPerf && (
              <p className="text-muted-foreground text-sm">No performance data available yet.</p>
            )}
          </div>
        )}

        {activeTab === "screenshots" && (
          <div className="max-w-3xl">
            <p className="text-muted-foreground text-sm">Screenshots coming soon. Check back after launch!</p>
          </div>
        )}

        {activeTab === "community" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-pixel text-[10px] text-foreground">
                Community Reviews ({gameComments.length})
              </h3>
              <Link to="/submit" className="pixel-btn text-[10px]">Write a Review</Link>
            </div>
            {gameComments.length === 0 && (
              <p className="text-sm text-muted-foreground">No community reviews yet. Be the first!</p>
            )}
            {gameComments.map((comment) => (
              <div key={comment.id} className="pixel-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{comment.avatar}</span>
                    <Link to={`/u/${comment.username}`} className="font-pixel text-[10px] text-pixel-cyan hover:underline">
                      {comment.username}
                    </Link>
                  </div>
                  <span className="rating-badge text-[10px]">{comment.score}</span>
                </div>
                <p className="text-sm text-muted-foreground">{comment.text}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{comment.date}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default GameDetail;
