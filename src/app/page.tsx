"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  getFeaturedGame,
  getTrendingGames,
  getNewReleases,
  getTopRated,
  getPersonalizedGames,
} from "@/lib/api";
import FeaturedHero from "@/components/FeaturedHero";
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
  const featured = useQuery({
    queryKey: ["featured"],
    queryFn: getFeaturedGame,
  });
  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: getTrendingGames,
  });
  const newReleases = useQuery({
    queryKey: ["newReleases"],
    queryFn: () => getNewReleases(8),
  });
  const topRated = useQuery({
    queryKey: ["topRated"],
    queryFn: () => getTopRated(8),
  });
  const personalized = useQuery({
    queryKey: ["personalized"],
    queryFn: () => getPersonalizedGames(6),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      {/* ── Featured Hero ── */}
      <FadeInSection>
        {featured.isLoading ? (
          <HeroSkeleton />
        ) : featured.data ? (
          <FeaturedHero game={featured.data} />
        ) : null}
      </FadeInSection>

      {/* ── Trending Now ── */}
      <FadeInSection>
        <section>
          {trending.isLoading ? (
            <>
              <SectionHeaderSkeleton />
              <GameGridSkeleton count={4} />
            </>
          ) : trending.data && trending.data.length > 0 ? (
            <>
              <SectionHeader title="Trending Now" href="/search?sort=trending" />
              <HorizontalScroll>
              {trending.data.map((game) => (
                <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                  <GameCard game={game} />
                </div>
              ))}
            </HorizontalScroll>
          </>
        ) : null}
      </section>
      </FadeInSection>

      {/* ── New Releases ── */}
      <FadeInSection>
        <section>
          {newReleases.isLoading ? (
          <>
            <SectionHeaderSkeleton />
            <GameGridSkeleton count={4} />
          </>
        ) : newReleases.data ? (
          <>
            <SectionHeader title="New Releases" href="/search?sort=newest" />
            <GameGrid games={newReleases.data} />
          </>
        ) : null}
      </section>
      </FadeInSection>

      {/* ── Top Rated ── */}
      <FadeInSection>
        <section>
          {topRated.isLoading ? (
          <>
            <SectionHeaderSkeleton />
            <GameGridSkeleton count={4} />
          </>
        ) : topRated.data ? (
          <>
            <SectionHeader title="Top Rated" href="/search?sort=top-rated" />
            <GameGrid games={topRated.data} />
          </>
        ) : null}
      </section>
      </FadeInSection>

      {/* ── Because You Viewed… ── */}
      <FadeInSection>
        <section>
          {personalized.isLoading ? (
          <>
            <SectionHeaderSkeleton />
            <GameGridSkeleton count={4} />
          </>
        ) : personalized.data && personalized.data.length > 0 ? (
          <>
            <SectionHeader title="Because You Viewed Hades II" />
            <HorizontalScroll>
              {personalized.data.map((game) => (
                <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                  <GameCard game={game} />
                </div>
              ))}
            </HorizontalScroll>
          </>
        ) : null}
      </section>
      </FadeInSection>

      {/* ── Footer ── */}
      <FadeInSection>
      <footer className="border-t border-border pt-8 pb-4 text-center space-y-2">
        <p className="text-accent font-bold text-sm">VERDICT<span className="text-secondary font-light">.games</span></p>
        <p className="text-xs text-tertiary">
          Honest verdicts for PC & Android games. Built with care.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-tertiary">
          <a href="/about" className="hover:text-secondary transition-colors">About</a>
          <a href="/privacy" className="hover:text-secondary transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-secondary transition-colors">Terms</a>
        </div>
      </footer>
      </FadeInSection>
    </div>
  );
}
