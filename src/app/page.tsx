"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  getFeaturedGames,
  getTrendingGames,
  getNewReleases,
  getTopRated,
  getPersonalizedGames,
  getRecommendations,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import HeroCarousel from "@/components/HeroCarousel";
import FadeInSection from "@/components/FadeInSection";
import GameCard from "@/components/GameCard";
import GameGrid from "@/components/GameGrid";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import {
  HeroSkeleton,
  GameGridSkeleton,
  SectionHeaderSkeleton,
} from "@/components/ui/Skeleton";

export default function HomePage() {
  const { user } = useAuth();

  const featured = useQuery({
    queryKey: ["featured"],
    queryFn: () => getFeaturedGames(5),
    staleTime: 5 * 60 * 1000,
  });
  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: getTrendingGames,
    staleTime: 5 * 60 * 1000,
  });
  const newReleases = useQuery({
    queryKey: ["newReleases"],
    queryFn: () => getNewReleases(8),
    staleTime: 5 * 60 * 1000,
  });
  const topRated = useQuery({
    queryKey: ["topRated"],
    queryFn: () => getTopRated(8),
    staleTime: 5 * 60 * 1000,
  });
  const personalized = useQuery({
    queryKey: ["personalized", !!user],
    queryFn: () => (user ? getRecommendations(8) : getPersonalizedGames(8)),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-0 page-enter">
      {/* ── Hero Carousel ── */}
      <section className="relative">
        <div className="absolute inset-0 hero-spotlight pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 pt-4 sm:pt-6 pb-8 sm:pb-10">
          <FadeInSection>
            {featured.isLoading ? (
              <HeroSkeleton />
            ) : featured.data && featured.data.length > 0 ? (
              <HeroCarousel games={featured.data} interval={7000} />
            ) : null}
          </FadeInSection>
        </div>
      </section>

      {/* ── Trending Now ── */}
      <section className="relative py-10">
        <div className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 relative">
          <FadeInSection>
            {trending.isLoading ? (
              <>
                <SectionHeaderSkeleton />
                <GameGridSkeleton count={4} />
              </>
            ) : trending.data && trending.data.length > 0 ? (
              <>
                <SectionHeader
                  title="Most Played Right Now"
                  href="/search?sort=trending"
                  icon="🔥"
                  subtitle="Ranked by Steam concurrent players"
                />
                {/* Spotlight first game + scroll for the rest */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Large spotlight card */}
                  <div className="lg:col-span-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <GameCard game={trending.data[0]} priority className="h-full" variant="spotlight" />
                    </motion.div>
                  </div>
                  {/* Remaining trending games */}
                  <div className="lg:col-span-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {trending.data.slice(1, 9).map((game, i) => (
                        <motion.div
                          key={game.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
                        >
                          <GameCard game={game} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-7xl mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* ── New Releases ── */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <FadeInSection>
            {newReleases.isLoading ? (
              <>
                <SectionHeaderSkeleton />
                <GameGridSkeleton count={4} />
              </>
            ) : newReleases.data && newReleases.data.length > 0 ? (
              <>
                <SectionHeader
                  title="New Releases"
                  href="/search?sort=newest"
                  icon="✨"
                  subtitle="Fresh games worth your attention"
                />
                <GameGrid games={newReleases.data} />
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      {/* ── Top Rated ── */}
      <section className="relative py-12">
        <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 relative">
          <FadeInSection>
            {topRated.isLoading ? (
              <>
                <SectionHeaderSkeleton />
                <GameGridSkeleton count={4} />
              </>
            ) : topRated.data && topRated.data.length > 0 ? (
              <>
                <SectionHeader
                  title="Top Verdict Scores"
                  href="/search?sort=top-rated"
                  icon="🏆"
                  subtitle="Highest-scored games from Steam, IGDB & Metacritic signals"
                />
                <GameGrid games={topRated.data} />
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-7xl mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* ── Because You Viewed… ── */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <FadeInSection>
            {personalized.isLoading ? (
              <>
                <SectionHeaderSkeleton />
                <GameGridSkeleton count={4} />
              </>
            ) : personalized.data && personalized.data.length > 0 ? (
              <>
                <SectionHeader
                  title={user ? "Recommended For You" : "You Might Enjoy"}
                  icon="💎"
                  subtitle={user ? "Based on your library" : "Games we think you'll love"}
                />
                <HorizontalScroll>
                  {personalized.data.map((game) => (
                    <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                      <GameCard game={game} />
                    </div>
                  ))}
                </HorizontalScroll>
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] bg-black/30">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <FadeInSection>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-lg font-bold">
                  <span className="gradient-text">VERDICT</span>
                  <span className="text-secondary font-light">.games</span>
                </p>
                <p className="text-xs text-tertiary mt-1">
                  Honest verdicts for PC & Android games. Built with care.
                </p>
              </div>
              <div className="flex items-center gap-6 text-xs text-tertiary">
                <a href="/about" className="hover:text-accent transition-colors">About</a>
                <a href="/privacy" className="hover:text-accent transition-colors">Privacy</a>
                <a href="/terms" className="hover:text-accent transition-colors">Terms</a>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
              <p className="text-[10px] text-tertiary">
                Data from RAWG, Steam, IGDB, CheapShark & Wikipedia. All trademarks belong to their respective owners.
              </p>
            </div>
          </FadeInSection>
        </div>
      </footer>
    </div>
  );
}
