"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  getGXDeals,
  getGXPopularNews,
  getGXTopGames,
  getGXFreeToPlay,
  getGXTopLiked,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { Platform } from "@/lib/types";
import { slugify } from "@/lib/utils/slugify";
import HeroCarousel from "@/components/HeroCarousel";
import FadeInSection from "@/components/FadeInSection";
import GameCard from "@/components/GameCard";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import GXDealCard from "@/components/GXDealCard";
import GXNewsCard from "@/components/GXNewsCard";
import GXServiceBadge from "@/components/GXServiceBadge";
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
  { label: "Android", value: "Android" },
];

export default function HomePage() {
  const { user } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "All">("PC");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const featured = useQuery({
    queryKey: ["featured"],
    queryFn: () => getFeaturedGames(5),
    staleTime: 5 * 60 * 1000,
  });
  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: () => getTrendingGames(),
    staleTime: 5 * 60 * 1000,
  });
  const newReleases = useQuery({
    queryKey: ["newReleases"],
    queryFn: () => getNewReleases(16),
    staleTime: 5 * 60 * 1000,
  });
  const topRated = useQuery({
    queryKey: ["topRated"],
    queryFn: () => getTopRated(16),
    staleTime: 5 * 60 * 1000,
  });
  const upcoming = useQuery({
    queryKey: ["upcoming"],
    queryFn: () => getUpcomingGames(16),
    staleTime: 10 * 60 * 1000,
  });
  const topByPlatform = useQuery({
    queryKey: ["topByPlatform", selectedPlatform],
    queryFn: () => getTopByPlatform(selectedPlatform, 16),
    staleTime: 5 * 60 * 1000,
  });
  const personalized = useQuery({
    queryKey: ["personalized", !!user],
    queryFn: () => (user ? getRecommendations(12) : getPersonalizedGames(12)),
    staleTime: 5 * 60 * 1000,
  });

  const gxTopLiked = useQuery({
    queryKey: ["gx-top-liked"],
    queryFn: () => getGXTopLiked(),
    staleTime: 5 * 60 * 1000,
  });
  const gxDeals = useQuery({
    queryKey: ["gx-deals"],
    queryFn: () => getGXDeals(),
    staleTime: 5 * 60 * 1000,
  });
  const gxFreeToPlay = useQuery({
    queryKey: ["gx-free-to-play"],
    queryFn: () => getGXFreeToPlay(),
    staleTime: 5 * 60 * 1000,
  });
  const gxTopGames = useQuery({
    queryKey: ["gx-top-games"],
    queryFn: () => getGXTopGames(),
    staleTime: 5 * 60 * 1000,
  });
  const gxNews = useQuery({
    queryKey: ["gx-news"],
    queryFn: () => getGXPopularNews(),
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
                <HorizontalScroll>
                  {trending.data.slice(0, 12).map((game, i) => (
                    <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.4 }}
                      >
                        <GameCard game={game} priority={i === 0} />
                      </motion.div>
                    </div>
                  ))}
                </HorizontalScroll>
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-7xl mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
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
                <HorizontalScroll>
                  {newReleases.data.map((game, i) => (
                    <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.4 }}
                      >
                        <GameCard game={game} />
                      </motion.div>
                    </div>
                  ))}
                </HorizontalScroll>
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
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
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
            ) : (topRated.data && topRated.data.length > 0) || (topByPlatform.data && topByPlatform.data.length > 0) ? (
              <>
                <SectionHeader
                  title="Top Verdict Scores"
                  href="/search?sort=top-rated"
                  icon="🏆"
                  subtitle="Highest-scored games from Steam, IGDB & Metacritic signals"
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
                {selectedPlatform === "PC" &&
                topRated.data &&
                topRated.data.length > 0 ? (
                  <HorizontalScroll>
                    {topRated.data.map((game) => (
                      <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                        <GameCard game={game} />
                      </div>
                    ))}
                  </HorizontalScroll>
                ) : topByPlatform.isLoading ? (
                  <GameGridSkeleton count={4} />
                ) : topByPlatform.data && topByPlatform.data.length > 0 ? (
                  <HorizontalScroll>
                    {topByPlatform.data.map((game) => (
                      <div key={game.id} className="shrink-0 w-40 sm:w-48 md:w-52 lg:w-56">
                        <GameCard game={game} />
                      </div>
                    ))}
                  </HorizontalScroll>
                ) : (
                  <p className="text-secondary text-sm py-8 text-center">
                    No games found for this platform yet. Try browsing{" "}
                    <button
                      onClick={() => setSelectedPlatform("PC")}
                      className="text-accent hover:underline"
                    >
                      PC games
                    </button>{" "}
                    instead.
                  </p>
                )}
              </>
            ) : null}
          </FadeInSection>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-7xl mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
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

      {/* ── Hot Right Now (GX Top Liked) ── */}
      {gxTopLiked.data && gxTopLiked.data.length > 0 && (
        <>
          <div className="max-w-7xl mx-auto px-4">
            <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <section className="relative py-12">
            <div className="absolute inset-0 mesh-gradient opacity-40 pointer-events-none" />
            <div className="max-w-7xl mx-auto px-4 relative">
              <FadeInSection>
                <SectionHeader
                  title="Hot Right Now"
                  icon="🔥"
                  subtitle="Most anticipated games by community votes — live data"
                />
                <HorizontalScroll>
                  {gxTopLiked.data.map((game, i) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      className="shrink-0 w-44 sm:w-52"
                    >
                      <Link
                        href={`/game/${game.slug || slugify(game.title)}`}
                        className="block group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-accent/30 transition-all duration-300"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden">
                          {game.cover && (
                            <Image
                              src={game.cover}
                              alt={game.title}
                              fill
                              sizes="(max-width: 640px) 50vw, 20vw"
                              className="object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 bg-accent/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white flex items-center gap-1">
                            <span>♥</span> {game.likes.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-3 space-y-1.5">
                          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
                            {game.title}
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {game.genres.slice(0, 2).map((g) => (
                              <span key={g} className="text-[10px] text-tertiary font-medium">{g}</span>
                            ))}
                          </div>
                          {game.releaseDate && (
                            <p className="text-[10px] text-pixel-cyan font-medium">
                              {new Date(game.releaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </HorizontalScroll>
              </FadeInSection>
            </div>
          </section>
        </>
      )}

      {/* ── Best Deals (GX Super Deals) ── */}
      {gxDeals.data && gxDeals.data.length > 0 && (
        <>
          <div className="max-w-7xl mx-auto px-4">
            <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4">
              <FadeInSection>
                <SectionHeader
                  title="Best Deals"
                  icon="💰"
                  subtitle="Live discounts from top stores — updated every 5 minutes"
                />
                <HorizontalScroll>
                  {gxDeals.data.slice(0, 10).map((deal, i) => (
                    <motion.div
                      key={deal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4 }}
                      className="shrink-0 w-40 sm:w-48 md:w-52"
                    >
                      <GXDealCard deal={deal} />
                    </motion.div>
                  ))}
                </HorizontalScroll>
              </FadeInSection>
            </div>
          </section>
        </>
      )}

      {/* ── Free to Play (GX F2P) ── */}
      {gxFreeToPlay.data && gxFreeToPlay.data.length > 0 && (
        <>
          <div className="max-w-7xl mx-auto px-4">
            <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <section className="relative py-12">
            <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
            <div className="max-w-7xl mx-auto px-4 relative">
              <FadeInSection>
                <SectionHeader
                  title="Free to Play"
                  icon="🆓"
                  subtitle="Jump right in — no wallet required"
                />
                <HorizontalScroll>
                  {gxFreeToPlay.data.slice(0, 12).map((game, i) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      className="shrink-0 w-44 sm:w-52"
                    >
                      <Link
                        href={`/game/${slugify(game.title)}`}
                        className="block group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-pixel-green/30 transition-all duration-300"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden">
                          {game.cover && (
                            <Image
                              src={game.cover}
                              alt={game.title}
                              fill
                              sizes="(max-width: 640px) 50vw, 20vw"
                              className="object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute top-2.5 left-2.5">
                            <span className="text-[10px] font-bold text-white bg-pixel-green/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
                              FREE
                            </span>
                          </div>
                        </div>
                        <div className="p-3 space-y-1.5">
                          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-pixel-green transition-colors">
                            {game.title}
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {game.genres.slice(0, 2).map((g) => (
                              <span key={g} className="text-[10px] text-tertiary font-medium">{g}</span>
                            ))}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </HorizontalScroll>
              </FadeInSection>
            </div>
          </section>
        </>
      )}

      {/* ── PS Plus & Game Pass (GX Top Games) ── */}
      {gxTopGames.data && gxTopGames.data.length > 0 && (() => {
        const SERVICE_TABS = [
          { label: "All", value: "all" },
          { label: "PS Plus", value: "PS PLUS" },
          { label: "Game Pass", value: "GAMEPASS" },
          { label: "PS+ Extra", value: "PS + EXTRA" },
        ];
        const filtered = serviceFilter === "all"
          ? gxTopGames.data
          : gxTopGames.data.filter((g) => g.serviceTag === serviceFilter);

        return (
          <>
            <div className="max-w-7xl mx-auto px-4">
              <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
            <section className="py-12">
              <div className="max-w-7xl mx-auto px-4">
                <FadeInSection>
                  <SectionHeader
                    title="On PS Plus & Game Pass"
                    icon="🎮"
                    subtitle="Games available on subscription services right now"
                  />
                  <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
                    {SERVICE_TABS.map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => setServiceFilter(tab.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                          serviceFilter === tab.value
                            ? "bg-accent text-white shadow-sm shadow-accent/20"
                            : "bg-white/5 text-secondary hover:text-foreground hover:bg-white/10 border border-white/10"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <HorizontalScroll>
                    {filtered.slice(0, 16).map((game, i) => (
                      <motion.div
                        key={game.id + i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.4 }}
                        className="shrink-0 w-44 sm:w-52"
                      >
                        <Link
                          href={`/game/${slugify(game.title)}`}
                          className="block group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-accent/30 transition-all duration-300"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden">
                            {game.cover && (
                              <Image
                                src={game.cover}
                                alt={game.title}
                                fill
                                sizes="(max-width: 640px) 50vw, 20vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            {game.serviceTag && (
                              <div className="absolute top-2.5 left-2.5">
                                <GXServiceBadge name={game.serviceTag} color={game.serviceColor} />
                              </div>
                            )}
                          </div>
                          <div className="p-3 space-y-1.5">
                            <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
                              {game.title}
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {game.genres.slice(0, 2).map((g) => (
                                <span key={g} className="text-[10px] text-tertiary font-medium">{g}</span>
                              ))}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </HorizontalScroll>
                </FadeInSection>
              </div>
            </section>
          </>
        );
      })()}

      {/* ── Gaming News (GX Popular News) ── */}
      {gxNews.data && gxNews.data.length > 0 && (
        <>
          <div className="max-w-7xl mx-auto px-4">
            <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4">
              <FadeInSection>
                <SectionHeader
                  title="Gaming News"
                  icon="📰"
                  subtitle="Trending stories from top gaming outlets"
                />
                <HorizontalScroll>
                  {gxNews.data.slice(0, 8).map((article, i) => (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      className="shrink-0 w-64 sm:w-72 md:w-80"
                    >
                      <GXNewsCard article={article} />
                    </motion.div>
                  ))}
                </HorizontalScroll>
              </FadeInSection>
            </div>
          </section>
        </>
      )}

      {/* ── Data Sources Banner ── */}
      <section className="border-t border-b border-border bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <FadeInSection>
            <div className="text-center space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold">
                <span className="gradient-text">Multi-Source</span>{" "}
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

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-surface/50">
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

            <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] text-tertiary">
                © {new Date().getFullYear()} verdict.games — Data from RAWG, Steam, IGDB, CheapShark, Wikipedia, HLTB & GX Corner.
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
