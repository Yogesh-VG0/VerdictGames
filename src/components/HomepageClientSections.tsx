"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  getRecommendations,
  getGXFreeToPlay,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/utils/slugify";
import { cn } from "@/lib/utils";
import type { Game, GXDeal } from "@/lib/types";
import FadeInSection from "@/components/FadeInSection";
import GameCard from "@/components/GameCard";
import HorizontalScroll from "@/components/HorizontalScroll";
import SectionHeader from "@/components/SectionHeader";
import GXDealCard from "@/components/GXDealCard";
import {
  HorizontalScrollSkeleton,
  SectionHeaderSkeleton,
} from "@/components/ui/Skeleton";
import {
  Gem,
  Gamepad2,
  Sparkles,
  Tag,
  Gift,
  ExternalLink,
} from "lucide-react";

type DiscoverTab = "new" | "deals" | "free";

interface HomepageClientSectionsProps {
  initialRecommendations: Game[];
  initialNewReleases: Game[];
  initialDeals: GXDeal[];
  excludedRecommendationIds: string[];
}

const CARD_WIDTH = "shrink-0 w-44 sm:w-52 md:w-56 lg:w-60 h-full";

const DISCOVER_TABS: { label: string; value: DiscoverTab; icon: ReactNode }[] = [
  { label: "New Releases", value: "new", icon: <Sparkles className="w-4 h-4" /> },
  { label: "Deals", value: "deals", icon: <Tag className="w-4 h-4" /> },
  { label: "Free to Play", value: "free", icon: <Gift className="w-4 h-4" /> },
];

export default function HomepageClientSections({
  initialRecommendations,
  initialNewReleases,
  initialDeals,
  excludedRecommendationIds,
}: HomepageClientSectionsProps) {
  const { user } = useAuth();
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("new");

  const personalized = useQuery({
    queryKey: ["personalized", user?.id ?? null],
    queryFn: () => getRecommendations(20),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const excludedRecommendationIdSet = new Set(excludedRecommendationIds);
  const gxFreeToPlay = useQuery({
    queryKey: ["gx-free-to-play"],
    queryFn: () => getGXFreeToPlay(),
    staleTime: 60 * 60 * 1000,
    enabled: discoverTab === "free",
  });

  const personalizedGames = (personalized.data ?? []).filter((game) => !excludedRecommendationIdSet.has(game.id));
  const fallbackRecommendationIds = new Set(personalizedGames.map((game) => game.id));
  const fallbackRecommendations = initialRecommendations.filter((game) => !fallbackRecommendationIds.has(game.id));
  const mergedPersonalizedGames = [...personalizedGames, ...fallbackRecommendations];
  const showingPersonalized = !!user && mergedPersonalizedGames.length > 0;
  const recommendedGames = showingPersonalized ? mergedPersonalizedGames : initialRecommendations;
  const recommendedLoading = !!user && personalized.isLoading && initialRecommendations.length === 0;

  return (
    <>
      {/* ── 4. Discover — tabbed ── */}
      <section className="relative py-12 sm:py-16">
        <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-4 relative">
          <FadeInSection>
            <SectionHeader
              title="Discover"
              href={discoverTab === "deals" ? "/search?tab=deals" : discoverTab === "free" ? "/search?tab=free" : "/search?sort=newest"}
              linkLabel={discoverTab === "deals" ? "See all deals" : discoverTab === "free" ? "See all free games" : "See all new releases"}
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
                {initialNewReleases.length > 0 ? (
                  <HorizontalScroll>
                    {initialNewReleases.filter((game) => game.coverImage).map((game, index) => (
                      <div key={game.id} className={CARD_WIDTH}>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.4 }}
                        >
                          <GameCard game={game} prefetch={false} />
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
                {initialDeals.length > 0 ? (
                  <HorizontalScroll>
                    {initialDeals.slice(0, 20).map((deal, index) => (
                      <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.4 }}
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
                    {gxFreeToPlay.data.slice(0, 20).map((game, index) => (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.4 }}
                        className={CARD_WIDTH}
                      >
                        <div className="flex flex-col h-full group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-pixel-green/30 transition-all duration-300">
                          <Link href={`/game/${slugify(game.title)}`} prefetch={false} className="block">
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
                          </Link>
                          <div className="p-3 flex-1 flex flex-col gap-1.5">
                            <Link href={`/game/${slugify(game.title)}`} prefetch={false}>
                              <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-pixel-green transition-colors">
                                {game.title}
                              </h3>
                            </Link>
                            <span className="text-[10px] text-tertiary font-medium truncate min-h-[16px]">
                              {game.genres.slice(0, 2).join(" · ") || "\u00A0"}
                            </span>
                            {game.url && (
                              <a
                                href={game.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 bg-pixel-green/15 text-pixel-green border border-pixel-green/20 hover:bg-pixel-green hover:text-black hover:border-pixel-green"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Play Free
                              </a>
                            )}
                          </div>
                        </div>
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

      <div className="max-w-[1400px] mx-auto px-4">
        <hr className="border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── 3. For You ── */}
      <section className="py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto px-4">
          <FadeInSection>
            {recommendedLoading ? (
              <>
                <SectionHeaderSkeleton />
                <HorizontalScrollSkeleton count={6} />
              </>
            ) : recommendedGames.length > 0 ? (
              <>
                <SectionHeader
                  title={showingPersonalized ? "Recommended For You" : "You Might Enjoy"}
                  icon={<Gem className="w-5 h-5" />}
                  subtitle={showingPersonalized ? "Based on your library & play history" : "Curated picks across diverse genres"}
                  gradient="linear-gradient(90deg, #a855f7 0%, #6366f1 25%, #ec4899 50%, #a855f7 75%, #6366f1 100%)"
                />
                <HorizontalScroll>
                  {recommendedGames.filter((game) => game.coverImage).map((game, index) => (
                    <div key={game.id} className={CARD_WIDTH}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03, duration: 0.4 }}
                      >
                        <GameCard game={game} prefetch={false} />
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
    </>
  );
}
