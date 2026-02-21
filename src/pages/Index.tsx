import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import GameCard from "@/components/GameCard";
import ReviewCard from "@/components/ReviewCard";
import { games, reviews } from "@/data/mockData";
import heroBanner from "@/assets/hero-banner.png";

const trending = games.slice(0, 8);
const latestReviews = reviews.slice(0, 6);
const topRated = [...games].sort((a, b) => b.score - a.score).slice(0, 8);

const Index = () => (
  <Layout>
    {/* Hero */}
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <img
        src={heroBanner}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="relative z-10 text-center px-4 py-20">
        <h1 className="font-pixel text-3xl md:text-5xl gold-text mb-4 animate-float">
          verdict.games
        </h1>
        <p className="text-lg md:text-xl text-foreground/80 mb-8 max-w-lg mx-auto">
          Honest reviews for PC and Android games.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/games" className="pixel-btn text-sm">
            Explore Games
          </Link>
          <Link to="/reviews" className="pixel-btn-secondary text-sm">
            Latest Reviews
          </Link>
        </div>
      </div>
    </section>

    {/* Trending */}
    <section className="container mx-auto px-4 py-12">
      <h2 className="font-pixel text-sm text-primary mb-6 glow-gold">Trending This Week</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {trending.map((game) => (
          <div key={game.slug} className="min-w-[220px] snap-start">
            <GameCard game={game} />
          </div>
        ))}
      </div>
    </section>

    {/* Latest Reviews */}
    <section className="container mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-pixel text-sm text-primary glow-gold">Latest Reviews</h2>
        <Link to="/reviews" className="font-pixel text-[10px] text-pixel-cyan hover:underline uppercase">
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {latestReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </section>

    {/* Top Rated */}
    <section className="container mx-auto px-4 py-12">
      <h2 className="font-pixel text-sm text-primary mb-6 glow-gold">Top Rated</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {topRated.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </section>

    {/* Why verdict.games */}
    <section className="container mx-auto px-4 py-12">
      <h2 className="font-pixel text-sm text-primary mb-8 text-center glow-gold">
        Why verdict.games?
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: "🎮",
            title: "Platform-Specific",
            desc: "Separate reviews for PC and Android — because the same game plays differently on each.",
          },
          {
            icon: "⚡",
            title: "Performance Notes",
            desc: "FPS, battery, heat for Android. Specs, settings, and benchmarks for PC. Real data, not marketing.",
          },
          {
            icon: "✅",
            title: "No-Fluff Verdicts",
            desc: "Must Play, Worth It, Wait for Sale, or Skip. We cut through the noise so you don't have to.",
          },
        ].map((item) => (
          <div key={item.title} className="pixel-card p-6 text-center">
            <div className="text-3xl mb-4">{item.icon}</div>
            <h3 className="font-pixel text-[10px] text-foreground mb-3">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Newsletter */}
    <section className="container mx-auto px-4 py-12">
      <div className="pixel-border-gold p-8 text-center max-w-2xl mx-auto">
        <h2 className="font-pixel text-sm text-primary mb-3">Stay Updated</h2>
        <p className="text-muted-foreground text-sm mb-6">Get weekly verdicts delivered to your inbox.</p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="your@email.com"
            className="flex-1 pixel-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <button className="pixel-btn text-[10px]">Subscribe</button>
        </div>
      </div>
    </section>
  </Layout>
);

export default Index;
