"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getDeveloperHub } from "@/lib/api";
import { scoreColor, cn } from "@/lib/utils";
import GameCard from "@/components/GameCard";
import FadeInSection from "@/components/FadeInSection";
import ScoreRing from "@/components/ui/ScoreRing";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import PixelButton from "@/components/ui/PixelButton";

interface Props {
  params: Promise<{ slug: string }>;
}

export default function DeveloperPage({ params }: Props) {
  const { slug } = use(params);

  const { data: hub, isLoading } = useQuery({
    queryKey: ["developer", slug],
    queryFn: () => getDeveloperHub(slug),
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-5xl">🏢</div>
        <h2 className="text-xl font-bold text-foreground">Developer not found</h2>
        <p className="text-sm text-secondary">
          We don&apos;t have data for this developer yet.
        </p>
        <Link href="/">
          <PixelButton variant="secondary">Back to Home</PixelButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 page-enter">
      {/* Hero */}
      <FadeInSection>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.08] bg-surface p-6 md:p-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-3xl shrink-0">
              🏢
            </div>
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {hub.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
                <span>{hub.gameCount} game{hub.gameCount !== 1 ? "s" : ""} on Verdict</span>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  Avg Score:{" "}
                  <span className={cn("font-bold", scoreColor(hub.averageScore))}>
                    {Math.round(hub.averageScore)}
                  </span>
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <ScoreRing score={Math.round(hub.averageScore)} size={72} strokeWidth={4} />
            </div>
          </div>
        </motion.div>
      </FadeInSection>

      {/* Games */}
      <FadeInSection>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 section-title-line">
          All Games by {hub.name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {hub.games.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <GameCard game={game} />
            </motion.div>
          ))}
        </div>
      </FadeInSection>
    </div>
  );
}
