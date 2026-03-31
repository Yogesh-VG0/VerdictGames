import type { Metadata } from "next";
import { Flame, Trophy } from "lucide-react";
import HeroCarousel from "@/components/HeroCarousel";
import FadeInSection from "@/components/FadeInSection";
import GameCard from "@/components/GameCard";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import HomepageClientSections, { HomepageMostAnticipatedSection } from "@/components/HomepageClientSections";
import HomepageNewsSection from "@/components/HomepageNewsSection";
import GradientText from "@/components/ui/GradientText";
import {
  HOMEPAGE_REVALIDATE_SECONDS,
  loadHomepageData,
} from "@/lib/services/homepage";

const CARD_WIDTH = "shrink-0 w-44 sm:w-52 md:w-56 lg:w-60 h-full";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const revalidate = 60;

if (HOMEPAGE_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Homepage page revalidate must stay aligned with the shared homepage loader.");
}

export const metadata: Metadata = {
  title: "The Verdict on Every Game",
  description:
    "Discover featured verdicts, trending games, top-rated releases, curated recommendations, and fresh gaming picks on verdict.games.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "verdict.games — The Verdict on Every Game",
    description:
      "Discover featured verdicts, trending games, top-rated releases, curated recommendations, and fresh gaming picks on verdict.games.",
    url: SITE_URL,
    siteName: "verdict.games",
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "verdict.games — The Verdict on Every Game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "verdict.games — The Verdict on Every Game",
    description:
      "Discover featured verdicts, trending games, top-rated releases, curated recommendations, and fresh gaming picks on verdict.games.",
    images: [{ url: "/og-default.png", alt: "verdict.games — The Verdict on Every Game" }],
  },
};

export default async function HomePage() {
  const homepage = await loadHomepageData();
  const featured = homepage.hero.filter((game) => game.headerImage || game.coverImage).slice(0, 6);
  const heroIds = new Set(featured.map((game) => game.id));
  const trendingGames = homepage.trending
    .filter((game) => !heroIds.has(game.id) && game.coverImage)
    .slice(0, 20);
  const topRatedGames = homepage.topRated
    .filter((game) => game.coverImage)
    .slice(0, 20);

  return (
    <div className="space-y-0 page-enter">
      {/* ── 1. Hero Carousel ── */}
      <section className="relative">
        <div className="absolute inset-0 hero-spotlight pointer-events-none" />
        <FadeInSection>
          {featured.length > 0 ? <HeroCarousel games={featured} interval={7000} /> : null}
        </FadeInSection>
      </section>

      {/* ── 2. Trending Now ── */}
      <section className="relative py-12 sm:py-16">
        <div className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-4 relative">
          <FadeInSection>
            {trendingGames.length > 0 ? (
              <>
                <SectionHeader
                  title="Trending Right Now"
                  href="/search?sort=trending"
                  linkLabel="View all"
                  icon={<Flame className="w-5 h-5" />}
                  subtitle="Based on recent player activity & community signals"
                  gradient="linear-gradient(90deg, #f97316 0%, #ef4444 25%, #f97316 50%, #eab308 75%, #f97316 100%)"
                />
                <HorizontalScroll>
                  {trendingGames.map((game) => (
                    <div key={game.id} className={CARD_WIDTH}>
                      <GameCard game={game} />
                    </div>
                  ))}
                </HorizontalScroll>
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <HomepageMostAnticipatedSection />

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── 5. Top Rated ── */}
      <section className="relative py-12 sm:py-16">
        <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-4 relative">
          <FadeInSection>
            {topRatedGames.length > 0 ? (
              <>
                <SectionHeader
                  title="Top Rated"
                  href="/search?sort=top-rated"
                  linkLabel="View all"
                  icon={<Trophy className="w-5 h-5" />}
                  subtitle="Highest-scoring recent releases"
                  gradient="linear-gradient(90deg, #facc15 0%, #f97316 25%, #eab308 50%, #22c55e 75%, #facc15 100%)"
                />
                <HorizontalScroll>
                  {topRatedGames.map((game) => (
                    <div key={game.id} className={CARD_WIDTH}>
                      <GameCard game={game} />
                    </div>
                  ))}
                </HorizontalScroll>
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <HomepageClientSections
        initialRecommendations={homepage.recommendations}
        initialNewReleases={homepage.newReleases}
        initialDeals={homepage.deals}
      />

      {/* ── 6. Gaming News ── */}
      <HomepageNewsSection />

      {/* ── Data Sources Banner ── */}
      <section className="border-t border-b border-border bg-surface/30">
        <div className="max-w-[1400px] mx-auto px-4 py-10">
          <FadeInSection>
            <div className="text-center space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold">
                <GradientText text="Multi-Source" gradient="linear-gradient(90deg, #a855f7 0%, #06b6d4 50%, #22c55e 100%)" className="font-bold" />{" "}
                <span className="text-foreground">Game Intelligence</span>
              </h2>
              <p className="text-sm text-secondary max-w-2xl mx-auto">
                Every game is enriched with data from 7 sources — giving you the most comprehensive verdict possible.
              </p>
              <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap pt-4">
                {[
                  { name: "RAWG", desc: "Metadata & Images", color: "text-foreground" },
                  { name: "Steam", desc: "Reviews & Players", color: "text-pixel-cyan" },
                  { name: "IGDB", desc: "Ratings & Trailers", color: "text-accent" },
                  { name: "CheapShark", desc: "Deals & Prices", color: "text-pixel-green" },
                  { name: "Wikipedia", desc: "Descriptions", color: "text-pixel-orange" },
                  { name: "HLTB", desc: "Playtime Data", color: "text-pixel-cyan" },
                  { name: "GX Corner", desc: "Live Trends & News", color: "text-accent" },
                ].map((src) => (
                  <div key={src.name} className="text-center">
                    <p className={`text-sm sm:text-base font-bold ${src.color}`}>{src.name}</p>
                    <p className="text-[10px] sm:text-xs text-tertiary">{src.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
