import type { Metadata } from "next";
import { Flame, Trophy } from "lucide-react";
import HeroCarousel from "@/components/HeroCarousel";
import FadeInSection from "@/components/FadeInSection";
import GameCard from "@/components/GameCard";
import HorizontalScroll from "@/components/HorizontalScroll";
import HomepageMostAnticipatedSection from "@/components/HomepageMostAnticipatedSection";
import SectionHeader from "@/components/SectionHeader";
import HomepageClientSections from "@/components/HomepageClientSections";
import HomepageNewsSection from "@/components/HomepageNewsSection";
import GradientText from "@/components/ui/GradientText";
import {
  HOMEPAGE_REVALIDATE_SECONDS,
  loadHomepageDataWithStatus,
  loadHomepageMostAnticipatedWithStatus,
} from "@/lib/services/homepage";
import { HOME_DESCRIPTION, HOME_TITLE, serializeJsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";

const CARD_WIDTH = "shrink-0 w-44 sm:w-52 md:w-56 lg:w-60 h-full";

export const revalidate = 300;
// Catalogue data is cached independently in the service layer. Render the
// shell at request time so a transient database outage cannot block a deploy.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

if (HOMEPAGE_REVALIDATE_SECONDS !== revalidate) {
  throw new Error("Homepage page revalidate must stay aligned with the shared homepage loader contract.");
}

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  alternates: {
    canonical: "/",
  },
};

const websiteUrl = new URL("/", SITE_URL).href;
const websiteJsonLd = serializeJsonLd({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${websiteUrl}#website`,
  name: SITE_NAME,
  alternateName: ["verdict.games", "VerdictGames"],
  url: websiteUrl,
  description: HOME_DESCRIPTION,
});

export default async function HomePage() {
  const [homepageResult, anticipatedResult] = await Promise.all([
    loadHomepageDataWithStatus(),
    loadHomepageMostAnticipatedWithStatus(),
  ]);
  const { data: homepage } = homepageResult;
  const mostAnticipatedGames = anticipatedResult.data;
  const degraded = homepageResult.degraded;
  const featured = homepage.hero.filter((game) => game.headerImage).slice(0, 6);
  const trendingGames = homepage.trending
    .filter((game) => game.coverImage)
    .slice(0, 20);
  const hasTrendingGames = trendingGames.length > 0;
  const hasMostAnticipatedGames = mostAnticipatedGames.length > 0;
  const topRatedGames = homepage.topRated
    .filter((game) => game.coverImage)
    .slice(0, 20);
  const hasTopRatedGames = topRatedGames.length > 0;

  return (
    <div className="space-y-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd }} />
      {degraded && (
        <p role="status" className="max-w-[1400px] mx-auto px-4 py-4 text-sm text-secondary">
          Some game collections are temporarily unavailable. You can still <a className="text-accent underline underline-offset-4" href="/search">browse available games</a> or try again shortly.
        </p>
      )}
      {/* ── 1. Hero Carousel ── */}
      <section className="relative">
        <div className="absolute inset-0 hero-spotlight pointer-events-none" />
        <FadeInSection>
          {featured.length > 0 ? <HeroCarousel games={featured} interval={7000} /> : null}
        </FadeInSection>
      </section>

      {/* ── 2. Trending Now ── */}
      {hasTrendingGames || !degraded ? (
        <>
          <section className="relative py-12 sm:py-16">
            <div className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none" />
            <div className="max-w-[1400px] mx-auto px-4 relative">
              <FadeInSection>
                <SectionHeader
                  title="Popular & Trending"
                  href="/search?sort=trending"
                  linkLabel="See trending games"
                  icon={<Flame className="w-5 h-5" />}
                  subtitle={hasTrendingGames
                    ? `${trendingGames.length} games ranked by player activity, growth, long-term popularity or editorial selection`
                    : "No games currently have enough activity or popularity evidence for this collection."}
                  gradient="linear-gradient(90deg, #f97316 0%, #ef4444 25%, #f97316 50%, #eab308 75%, #f97316 100%)"
                />
                {hasTrendingGames && <HorizontalScroll>
                  {trendingGames.map((game) => (
                    <div key={game.id} className={CARD_WIDTH}>
                      <GameCard game={game} priority={false} />
                    </div>
                  ))}
                </HorizontalScroll>}
              </FadeInSection>
            </div>
          </section>

          <div className="max-w-[1400px] mx-auto px-4">
            <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
        </>
      ) : null}

      {hasMostAnticipatedGames ? (
        <>
          <HomepageMostAnticipatedSection games={mostAnticipatedGames} />

          <div className="max-w-[1400px] mx-auto px-4">
            <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
        </>
      ) : null}

      {hasTopRatedGames ? (
        <>
          {/* ── 5. Top Rated ── */}
          <section className="relative py-12 sm:py-16">
            <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
            <div className="max-w-[1400px] mx-auto px-4 relative">
              <FadeInSection>
                <SectionHeader
                  title="Top Rated"
                  href="/search?sort=top-rated"
                  linkLabel="View all"
                  icon={<Trophy className="w-5 h-5" />}
                  subtitle="Highest-scoring standout games with strong popularity and staying power"
                  gradient="linear-gradient(90deg, #facc15 0%, #f97316 25%, #eab308 50%, #22c55e 75%, #facc15 100%)"
                />
                <HorizontalScroll>
                  {topRatedGames.map((game) => (
                    <div key={game.id} className={CARD_WIDTH}>
                      <GameCard game={game} priority={false} />
                    </div>
                  ))}
                </HorizontalScroll>
              </FadeInSection>
            </div>
          </section>

          <div className="max-w-[1400px] mx-auto px-4">
            <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
        </>
      ) : null}

      <HomepageClientSections
        shownGameSlugs={[...new Set([
          ...[...featured, ...trendingGames, ...topRatedGames, ...homepage.newReleases].map(game => game.slug),
          ...mostAnticipatedGames.map(game => game.slug),
        ])].join(",")}
        initialRecommendations={homepage.recommendations}
        initialNewReleases={homepage.newReleases}
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
                We combine available metadata, reviews, prices and playtime from these sources. Coverage varies by game.
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
