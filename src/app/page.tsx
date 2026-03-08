"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  getFeaturedGames,
  getTrendingGames,
  getNewReleases,
  getTopRated,
  getPersonalizedGames,
  getRecommendations,
  getUpcomingGames,
  getTopByPlatform,
  getSiteStats,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { Platform } from "@/lib/types";
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

const PLATFORM_TABS: { label: string; value: Platform }[] = [
  { label: "PC", value: "PC" },
  { label: "PS5", value: "PlayStation 5" },
  { label: "Xbox", value: "Xbox Series X|S" },
  { label: "Switch", value: "Nintendo Switch" },
  { label: "PS4", value: "PlayStation 4" },
];

export default function HomePage() {
  const { user } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "All">("PC");

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
    queryFn: () => getNewReleases(12),
    staleTime: 5 * 60 * 1000,
  });
  const topRated = useQuery({
    queryKey: ["topRated"],
    queryFn: () => getTopRated(12),
    staleTime: 5 * 60 * 1000,
  });
  const upcoming = useQuery({
    queryKey: ["upcoming"],
    queryFn: () => getUpcomingGames(12),
    staleTime: 10 * 60 * 1000,
  });
  const topByPlatform = useQuery({
    queryKey: ["topByPlatform", selectedPlatform],
    queryFn: () => getTopByPlatform(selectedPlatform, 12),
    staleTime: 5 * 60 * 1000,
  });
  const personalized = useQuery({
    queryKey: ["personalized", !!user],
    queryFn: () => (user ? getRecommendations(8) : getPersonalizedGames(8)),
    staleTime: 5 * 60 * 1000,
  });
  const stats = useQuery({
    queryKey: ["siteStats"],
    queryFn: getSiteStats,
    staleTime: 60 * 60 * 1000,
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

      {/* ── Site Stats Bar ── */}
      {stats.data && (stats.data.totalGames > 0) && (
        <section className="relative border-y border-white/[0.06] bg-surface/50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-center gap-6 sm:gap-12 flex-wrap text-center">
              <div>
                <p className="text-xl sm:text-2xl font-bold gradient-text">{stats.data.totalGames.toLocaleString()}+</p>
                <p className="text-[10px] sm:text-xs text-tertiary uppercase tracking-wider">Games</p>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-accent">{stats.data.enrichmentSources}</p>
                <p className="text-[10px] sm:text-xs text-tertiary uppercase tracking-wider">Data Sources</p>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-pixel-green">{stats.data.totalReviews.toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-tertiary uppercase tracking-wider">Reviews</p>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-pixel-cyan">{stats.data.totalUsers.toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-tertiary uppercase tracking-wider">Members</p>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {/* ── Upcoming Games ── */}
      {upcoming.data && upcoming.data.length > 0 && (
        <section className="relative py-12">
          <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 relative">
            <FadeInSection>
              <SectionHeader
                title="Upcoming Games"
                href="/calendar"
                icon="📅"
                subtitle="Most anticipated upcoming releases"
              />
              <HorizontalScroll>
                {upcoming.data.map((game) => (
                  <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                    <GameCard game={game} />
                  </div>
                ))}
              </HorizontalScroll>
            </FadeInSection>
          </div>
        </section>
      )}

      {/* ── Divider ── */}
      <div className="max-w-7xl mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

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

      {/* ── Top by Platform ── */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <FadeInSection>
            <SectionHeader
              title="Best Games by Platform"
              href="/search?sort=top-rated"
              icon="🎮"
              subtitle="Browse top-rated games across all platforms"
            />
            {/* Platform tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
              {PLATFORM_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedPlatform(tab.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    selectedPlatform === tab.value
                      ? "bg-accent text-white shadow-sm shadow-accent/20"
                      : "bg-white/5 text-secondary hover:text-foreground hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {topByPlatform.isLoading ? (
              <GameGridSkeleton count={4} />
            ) : topByPlatform.data && topByPlatform.data.length > 0 ? (
              <GameGrid games={topByPlatform.data} />
            ) : (
              <p className="text-secondary text-sm py-8 text-center">No games found for this platform yet. Games are being discovered automatically!</p>
            )}
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

      {/* ── Data Sources Banner ── */}
      <section className="border-t border-b border-white/[0.06] bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <FadeInSection>
            <div className="text-center space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold">
                <span className="gradient-text">Multi-Source</span>{" "}
                <span className="text-foreground">Game Intelligence</span>
              </h2>
              <p className="text-sm text-secondary max-w-2xl mx-auto">
                Every game is enriched with data from 5 sources — giving you the most comprehensive verdict possible.
              </p>
              <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap pt-4">
                {[
                  { name: "RAWG", desc: "Metadata & Images", color: "text-foreground" },
                  { name: "Steam", desc: "Reviews & Players", color: "text-pixel-cyan" },
                  { name: "IGDB", desc: "Ratings & Trailers", color: "text-accent" },
                  { name: "CheapShark", desc: "Deals & Prices", color: "text-pixel-green" },
                  { name: "Wikipedia", desc: "Descriptions", color: "text-pixel-orange" },
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

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] bg-black/30">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <FadeInSection>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Brand */}
              <div className="md:col-span-1">
                <p className="text-lg font-bold">
                  <span className="gradient-text">VERDICT</span>
                  <span className="text-secondary font-light">.games</span>
                </p>
                <p className="text-xs text-tertiary mt-2 leading-relaxed">
                  Your trusted source for honest game verdicts. Data-driven reviews powered by 5 APIs.
                </p>
              </div>

              {/* Browse */}
              <div>
                <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Browse</h4>
                <ul className="space-y-2 text-sm text-tertiary">
                  <li><Link href="/search?sort=trending" className="hover:text-accent transition-colors">Trending</Link></li>
                  <li><Link href="/search?sort=newest" className="hover:text-accent transition-colors">New Releases</Link></li>
                  <li><Link href="/search?sort=top-rated" className="hover:text-accent transition-colors">Top Rated</Link></li>
                  <li><Link href="/calendar" className="hover:text-accent transition-colors">Upcoming</Link></li>
                  <li><Link href="/lists" className="hover:text-accent transition-colors">Curated Lists</Link></li>
                </ul>
              </div>

              {/* Platforms */}
              <div>
                <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Platforms</h4>
                <ul className="space-y-2 text-sm text-tertiary">
                  <li><Link href="/search?platform=PC" className="hover:text-accent transition-colors">PC</Link></li>
                  <li><Link href="/search?platform=PlayStation+5" className="hover:text-accent transition-colors">PlayStation 5</Link></li>
                  <li><Link href="/search?platform=Xbox+Series+X%7CS" className="hover:text-accent transition-colors">Xbox Series X|S</Link></li>
                  <li><Link href="/search?platform=Nintendo+Switch" className="hover:text-accent transition-colors">Nintendo Switch</Link></li>
                  <li><Link href="/search?platform=Android" className="hover:text-accent transition-colors">Android</Link></li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">About</h4>
                <ul className="space-y-2 text-sm text-tertiary">
                  <li><Link href="/about" className="hover:text-accent transition-colors">About Us</Link></li>
                  <li><Link href="/reviews" className="hover:text-accent transition-colors">Community Reviews</Link></li>
                  <li><Link href="/compare" className="hover:text-accent transition-colors">Compare Games</Link></li>
                  <li><Link href="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-accent transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] text-tertiary">
                © {new Date().getFullYear()} verdict.games — Data from RAWG, Steam, IGDB, CheapShark & Wikipedia.
              </p>
              <p className="text-[10px] text-tertiary">
                All game titles, trademarks, and copyrights belong to their respective owners.
              </p>
            </div>
          </FadeInSection>
        </div>
      </footer>
    </div>
  );
}
