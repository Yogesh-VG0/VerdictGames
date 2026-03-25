"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  getHomepageData,
  getPersonalizedGames,
  getRecommendations,
  getGXPopularNews,
  getGXNewsFeed,
  getGXFreeToPlay,
  getRawgList,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/utils/slugify";
import { cn } from "@/lib/utils";
import HeroCarousel from "@/components/HeroCarousel";
import FadeInSection from "@/components/FadeInSection";
import GameCard from "@/components/GameCard";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import GXDealCard from "@/components/GXDealCard";
import LazySection from "@/components/LazySection";
import {
  HeroSkeleton,
  GameGridSkeleton,
  HorizontalScrollSkeleton,
  SectionHeaderSkeleton,
} from "@/components/ui/Skeleton";
import GradientText from "@/components/ui/GradientText";
import {
  Flame, Gem, Gamepad2, Trophy, Newspaper, Sparkles, Tag, Gift, Rocket,
} from "lucide-react";

type DiscoverTab = "new" | "deals" | "free";

const CARD_WIDTH = "shrink-0 w-44 sm:w-52 md:w-56 lg:w-60 h-full";

const DISCOVER_TABS: { label: string; value: DiscoverTab; icon: React.ReactNode }[] = [
  { label: "New Releases", value: "new", icon: <Sparkles className="w-4 h-4" /> },
  { label: "Deals", value: "deals", icon: <Tag className="w-4 h-4" /> },
  { label: "Free to Play", value: "free", icon: <Gift className="w-4 h-4" /> },
];

export default function HomePage() {
  const { user } = useAuth();
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("new");

  // ── Single homepage aggregator call ──
  const homepage = useQuery({
    queryKey: ["homepage"],
    queryFn: () => getHomepageData(),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
  // Hero pool — separate from trending rail (deduped server-side)
  const heroPool = {
    data: homepage.data?.hero,
    isLoading: homepage.isLoading,
  };
  const trending = {
    data: homepage.data?.trending,
    isLoading: homepage.isLoading,
  };
  const newReleases = {
    data: homepage.data?.newReleases,
    isLoading: homepage.isLoading,
  };
  const topRated = {
    data: homepage.data?.topRated,
    isLoading: homepage.isLoading,
  };
  const gxDeals = {
    data: homepage.data?.deals,
    isLoading: homepage.isLoading,
  };

  // Hero carousel: top 6 games by confidence-weighted score (server-sorted)
  const featured = useMemo(() => {
    const pool = heroPool.data ?? [];
    if (pool.length === 0) return [];
    return pool.slice(0, 6);
  }, [heroPool.data]);

  // heroIds used to prevent the same game appearing in the trending rail
  // (server deduplicates hero top-4 already; this catches the carousel pick)
  const heroIds = new Set(featured.map((g) => g.id));
  const personalized = useQuery({
    queryKey: ["personalized", !!user, trending.data?.length],
    queryFn: () => (user ? getRecommendations(20) : getPersonalizedGames(20, trending.data ?? undefined)),
    enabled: !!user || !!trending.data,
    staleTime: 5 * 60 * 1000,
  });
  const gxFreeToPlay = useQuery({
    queryKey: ["gx-free-to-play"],
    queryFn: () => getGXFreeToPlay(),
    staleTime: 5 * 60 * 1000,
    enabled: discoverTab === "free",
  });
  const anticipated = useQuery({
    queryKey: ["rawg-anticipated"],
    queryFn: () => getRawgList("best-of-year", { pageSize: 12 }),
    staleTime: 10 * 60 * 1000,
  });

  const gxNews = useQuery({
    queryKey: ["gx-news-merged"],
    queryFn: async () => {
      const [popular, feed] = await Promise.all([getGXPopularNews(), getGXNewsFeed()]);
      // Dedupe by normalized title, popular items first
      const seen = new Set<string>();
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const merged = [] as typeof popular;
      for (const a of [...popular, ...feed]) {
        const key = normalize(a.title);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(a);
        }
        if (merged.length >= 12) break;
      }
      return merged;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-0 page-enter">
      {/* ── 1. Hero Carousel ── */}
      <section className="relative">
        <div className="absolute inset-0 hero-spotlight pointer-events-none" />
        <FadeInSection>
          {heroPool.isLoading ? (
            <div className="max-w-[1400px] mx-auto px-4 pt-4 sm:pt-6 pb-8"><HeroSkeleton /></div>
          ) : featured.length > 0 ? (
            <HeroCarousel games={featured} interval={7000} />
          ) : null}
        </FadeInSection>
      </section>

      {/* ── 2. Trending Now ── */}
      <section className="relative py-12 sm:py-16">
        <div className="absolute inset-0 mesh-gradient opacity-50 pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-4 relative">
          <FadeInSection>
            {trending.isLoading ? (
              <>
                <SectionHeaderSkeleton />
                <HorizontalScrollSkeleton count={6} />
              </>
            ) : trending.data && trending.data.length > 0 ? (
              <>
                <SectionHeader
                  title="Trending Right Now"
                  href="/search?sort=trending"
                  linkLabel="See all trending"
                  icon={<Flame className="w-5 h-5" />}
                  subtitle="Based on recent player activity & community signals"
                  gradient="linear-gradient(90deg, #f97316 0%, #ef4444 25%, #f97316 50%, #eab308 75%, #f97316 100%)"
                />
                <HorizontalScroll>
                  {trending.data!.filter((g) => !heroIds.has(g.id)).slice(0, 20).map((game, i) => (
                    <div key={game.id} className={CARD_WIDTH}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.4 }}
                      >
                        <GameCard game={game} priority={i < 2} />
                      </motion.div>
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

      {/* ── 2b. Most Anticipated ── */}
      {anticipated.data && anticipated.data.items.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="max-w-[1400px] mx-auto px-4">
            <FadeInSection>
              <SectionHeader
                title="Most Anticipated"
                href="/explore"
                linkLabel="See all"
                icon={<Rocket className="w-5 h-5" />}
                subtitle="The most hyped upcoming games based on community interest"
                gradient="linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #06b6d4 75%, #3b82f6 100%)"
              />
              <HorizontalScroll>
                {anticipated.data.items.map((game, i) => (
                  <div key={game.rawgId} className="shrink-0 w-64 sm:w-72 md:w-80 h-full">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4 }}
                    >
                      <Link href={`/game/${game.slug}?rawgId=${game.rawgId}`} className="block group">
                        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-border bg-surface-2 group-hover:border-accent/40 transition-all">
                          {game.image ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={game.image}
                              alt={game.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10" />
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8">
                            <p className="text-sm font-bold text-white line-clamp-1 drop-shadow-lg">{game.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {game.genres.slice(0, 2).map((g, gi) => (
                                <span key={g} className="text-[10px] text-white/60">
                                  {gi > 0 && <span className="mr-1">·</span>}{g}
                                </span>
                              ))}
                              <span className="ml-auto text-[10px] font-medium">
                                {game.tba ? (
                                  <span className="text-yellow-400">TBA</span>
                                ) : game.released ? (
                                  <span className="text-white/50">{new Date(game.released).getFullYear()}</span>
                                ) : null}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 px-1 text-[10px] text-secondary">
                          <span className="text-accent font-medium">{game.added.toLocaleString()} wishlisted</span>
                          {game.toplay > 0 && <span>{game.toplay.toLocaleString()} want</span>}
                        </div>
                      </Link>
                    </motion.div>
                  </div>
                ))}
              </HorizontalScroll>
            </FadeInSection>
          </div>
        </section>
      )}

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── 3. For You ── */}
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <FadeInSection>
            {personalized.isLoading ? (
              <>
                <SectionHeaderSkeleton />
                <HorizontalScrollSkeleton count={6} />
              </>
            ) : personalized.data && personalized.data.length > 0 ? (
              <>
                <SectionHeader
                  title={user ? "Recommended For You" : "You Might Enjoy"}
                  icon={<Gem className="w-5 h-5" />}
                  subtitle={user ? "Based on your library & play history" : "Curated picks across diverse genres"}
                  gradient="linear-gradient(90deg, #a855f7 0%, #6366f1 25%, #ec4899 50%, #a855f7 75%, #6366f1 100%)"
                />
                <HorizontalScroll>
                  {personalized.data.map((game, i) => (
                    <div key={game.id} className={CARD_WIDTH}>
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

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── 4. Discover — tabbed ── */}
      <LazySection minHeight="400px">
        <section className="relative py-12 sm:py-16">
          <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
          <div className="max-w-[1400px] mx-auto px-4 relative">
            <FadeInSection>
              <SectionHeader
                title="Discover"
                href="/search?sort=newest"
                linkLabel="Browse all"
                icon={<Gamepad2 className="w-5 h-5" />}
                subtitle="Find your next obsession"
                gradient="linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #3b82f6 75%, #06b6d4 100%)"
              />
              <div className="flex items-center gap-2.5 mb-8 overflow-x-auto no-scrollbar pb-1">
                {DISCOVER_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setDiscoverTab(tab.value)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
                      discoverTab === tab.value
                        ? "bg-accent text-white shadow-sm shadow-accent/20"
                        : "bg-surface-2 text-secondary hover:text-foreground hover:bg-elevated border border-border"
                    )}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {discoverTab === "new" && (
                <>
                  {newReleases.isLoading ? (
                    <HorizontalScrollSkeleton count={6} />
                  ) : newReleases.data && newReleases.data.length > 0 ? (
                    <HorizontalScroll>
                      {newReleases.data.map((game, i) => (
                        <div key={game.id} className={CARD_WIDTH}>
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
                  ) : (
                    <p className="text-secondary text-sm py-8 text-center">No new releases found.</p>
                  )}
                </>
              )}

              {discoverTab === "deals" && (
                <>
                  {gxDeals.isLoading ? (
                    <HorizontalScrollSkeleton count={6} />
                  ) : gxDeals.data && gxDeals.data.length > 0 ? (
                    <HorizontalScroll>
                      {gxDeals.data.slice(0, 20).map((deal, i) => (
                        <motion.div
                          key={deal.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.4 }}
                          className={CARD_WIDTH}
                        >
                          <GXDealCard deal={deal} />
                        </motion.div>
                      ))}
                    </HorizontalScroll>
                  ) : (
                    <p className="text-secondary text-sm py-8 text-center">No deals available right now.</p>
                  )}
                </>
              )}

              {discoverTab === "free" && (
                <>
                  {gxFreeToPlay.isLoading ? (
                    <HorizontalScrollSkeleton count={6} />
                  ) : gxFreeToPlay.data && gxFreeToPlay.data.length > 0 ? (
                    <HorizontalScroll>
                      {gxFreeToPlay.data.slice(0, 20).map((game, i) => (
                        <motion.div
                          key={game.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.4 }}
                          className={CARD_WIDTH}
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
                  ) : (
                    <p className="text-secondary text-sm py-8 text-center">No free games available.</p>
                  )}
                </>
              )}
            </FadeInSection>
          </div>
        </section>
      </LazySection>

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── 5. Top Rated ── */}
      <LazySection minHeight="400px">
        <section className="relative py-12 sm:py-16">
          <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
          <div className="max-w-[1400px] mx-auto px-4 relative">
            <FadeInSection>
              {topRated.isLoading ? (
                <>
                  <SectionHeaderSkeleton />
                  <HorizontalScrollSkeleton count={6} />
                </>
              ) : topRated.data && topRated.data.length > 0 ? (
                <>
                  <SectionHeader
                    title="Top Rated"
                    href="/search?sort=top-rated"
                    linkLabel="See all top rated"
                    icon={<Trophy className="w-5 h-5" />}
                    subtitle="Highest-scoring recent releases"
                    gradient="linear-gradient(90deg, #facc15 0%, #f97316 25%, #eab308 50%, #22c55e 75%, #facc15 100%)"
                  />
                  <HorizontalScroll>
                    {topRated.data.slice(0, 20).map((game, i) => (
                      <div key={game.id} className={CARD_WIDTH}>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.4 }}
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
      </LazySection>

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── 6. Gaming News ── */}
      <LazySection minHeight="300px">
        {gxNews.data && gxNews.data.length > 0 && (
          <section className="py-12">
            <div className="max-w-[1400px] mx-auto px-4">
              <FadeInSection>
                <SectionHeader
                  title="Gaming News"
                  icon={<Newspaper className="w-5 h-5" />}
                  subtitle="Trending stories from top gaming outlets"
                  gradient="linear-gradient(90deg, #14b8a6 0%, #06b6d4 25%, #3b82f6 50%, #06b6d4 75%, #14b8a6 100%)"
                />
                {/* 2-column editorial layout: 2 featured + compact stack */}
                {(() => {
                  const articles = gxNews.data;
                  const featured = articles.slice(0, 2);
                  /* 10 compact items on the right to visually balance the 2 tall featured cards */
                  const rest = articles.slice(2, 12);

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Left column: 1–2 featured hero articles */}
                      <div className={`lg:col-span-5 ${featured.length === 1 ? "flex items-center" : "space-y-4"}`}>
                        {featured.map((article, idx) => (
                          <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                          >
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/30 transition-all"
                            >
                              <div className="relative aspect-video overflow-hidden">
                                {article.image ? (
                                  <Image
                                    src={article.image}
                                    alt={article.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    sizes="(max-width: 1024px) 100vw, 40vw"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-accent/20 to-pixel-cyan/20 flex items-center justify-center">
                                    <Newspaper className="w-8 h-8 text-accent/60" />
                                  </div>
                                )}
                              </div>
                              <div className="p-4 space-y-2">
                                <h3 className="text-base font-bold text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                                  {article.title}
                                </h3>
                                <div className="flex items-center gap-2">
                                  {article.publisherFavicon && (
                                    <Image
                                      src={article.publisherFavicon}
                                      alt=""
                                      width={14}
                                      height={14}
                                      className="rounded-sm"
                                    />
                                  )}
                                  <span className="text-xs text-tertiary">{article.publisherName}</span>
                                </div>
                              </div>
                            </a>
                          </motion.div>
                        ))}
                      </div>

                      {/* Right column: compact stacked articles — hide overflow on mobile via CSS */}
                      {rest.length > 0 && (
                        <div className="lg:col-span-7 space-y-2 max-h-[320px] lg:max-h-none overflow-hidden">
                          {rest.map((article, i) => (
                            <motion.a
                              key={article.id}
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04, duration: 0.3 }}
                              className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 hover:border-accent/30 hover:bg-surface-2 transition-all"
                            >
                              <div className="relative w-20 h-14 shrink-0 rounded-lg overflow-hidden">
                                {article.image ? (
                                  <Image
                                    src={article.image}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="80px"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10 flex items-center justify-center">
                                    <Newspaper className="w-5 h-5 text-accent/60" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                                  {article.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  {article.publisherFavicon && (
                                    <Image
                                      src={article.publisherFavicon}
                                      alt=""
                                      width={12}
                                      height={12}
                                      className="rounded-sm"
                                    />
                                  )}
                                  <span className="text-[10px] text-tertiary">{article.publisherName}</span>
                                </div>
                              </div>
                            </motion.a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </FadeInSection>
            </div>
          </section>
        )}
      </LazySection>

      {/* ── Data Sources Banner ── */}
      <section className="border-t border-b border-border bg-surface/30">
        <div className="max-w-[1400px] mx-auto px-4 py-10">
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
        <div className="max-w-[1400px] mx-auto px-4 py-12">
          <FadeInSection>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-1">
                <p className="text-lg font-bold">
                  <span className="gradient-text">VERDICT</span>
                  <span className="text-secondary font-light">.games</span>
                </p>
                <p className="text-xs text-tertiary mt-2 leading-relaxed">
                  Your trusted source for honest game verdicts. Data-driven reviews powered by 7 sources.
                </p>
              </div>
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
