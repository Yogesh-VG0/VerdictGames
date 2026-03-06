"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { compareGames, searchGames } from "@/lib/api";
import { scoreColor, cn, formatDate } from "@/lib/utils";
import ScoreRing from "@/components/ui/ScoreRing";
import VerdictBadge from "@/components/ui/VerdictBadge";
import PixelBadge from "@/components/ui/PixelBadge";
import FadeInSection from "@/components/FadeInSection";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Game } from "@/lib/types";

function CompareCell({ label, v1, v2, higher = "none" }: {
  label: string;
  v1: React.ReactNode;
  v2: React.ReactNode;
  higher?: "left" | "right" | "none";
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-3 border-b border-white/[0.06] last:border-0 items-center">
      <div className={cn(
        "text-sm font-medium text-right pr-2",
        higher === "left" ? "text-accent" : "text-foreground"
      )}>
        {v1}
      </div>
      <div className="text-center text-xs text-tertiary uppercase tracking-wider font-bold">
        {label}
      </div>
      <div className={cn(
        "text-sm font-medium pl-2",
        higher === "right" ? "text-accent" : "text-foreground"
      )}>
        {v2}
      </div>
    </div>
  );
}

function GameSearchInput({ value, onSelect, placeholder }: {
  value: string;
  onSelect: (slug: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const { data: results } = useQuery({
    queryKey: ["compareSearch", query],
    queryFn: () => searchGames({ query, page: 1 }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-11 px-4 text-sm rounded-xl bg-surface border border-white/[0.08] text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
      />
      {open && results && results.items.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 max-h-60 overflow-auto rounded-xl bg-surface border border-white/[0.08] shadow-2xl">
          {results.items.slice(0, 6).map((g) => (
            <button
              key={g.id}
              onClick={() => {
                onSelect(g.slug);
                setQuery(g.title);
                setOpen(false);
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              <div className="relative w-8 h-11 rounded-lg overflow-hidden shrink-0">
                <Image src={g.coverImage} alt={g.title} fill sizes="32px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{g.title}</p>
                <p className="text-xs text-tertiary">{g.developer}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function scoreHigher(a?: number, b?: number): "left" | "right" | "none" {
  if (a == null || b == null) return "none";
  if (a > b) return "left";
  if (b > a) return "right";
  return "none";
}

function GameHeader({ game }: { game: Game }) {
  return (
    <Link href={`/game/${game.slug}`} className="flex flex-col items-center gap-3 group">
      <div className="relative w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden border border-white/[0.08] group-hover:border-accent/40 transition-colors">
        <Image src={game.coverImage} alt={game.title} fill sizes="112px" className="object-cover" />
      </div>
      <h3 className="text-sm font-bold text-foreground text-center group-hover:text-accent transition-colors line-clamp-2">
        {game.title}
      </h3>
    </Link>
  );
}

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const g1 = searchParams.get("g1") ?? "";
  const g2 = searchParams.get("g2") ?? "";

  const [slug1, setSlug1] = useState(g1);
  const [slug2, setSlug2] = useState(g2);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", slug1, slug2],
    queryFn: () => compareGames(slug1, slug2),
    enabled: slug1.length > 0 && slug2.length > 0,
  });

  function handleSelect(side: 1 | 2, slug: string) {
    const next1 = side === 1 ? slug : slug1;
    const next2 = side === 2 ? slug : slug2;
    if (side === 1) setSlug1(slug); else setSlug2(slug);
    if (next1 && next2) {
      router.replace(`/compare?g1=${encodeURIComponent(next1)}&g2=${encodeURIComponent(next2)}`);
    }
  }

  const game1 = data?.game1;
  const game2 = data?.game2;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 page-enter">
      <FadeInSection>
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            ⚔️ Game Comparison
          </h1>
          <p className="text-sm text-secondary">
            Compare two games side-by-side
          </p>
        </div>
      </FadeInSection>

      {/* Search inputs */}
      <FadeInSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GameSearchInput value={g1} onSelect={(s) => handleSelect(1, s)} placeholder="Search first game..." />
          <GameSearchInput value={g2} onSelect={(s) => handleSelect(2, s)} placeholder="Search second game..." />
        </div>
      </FadeInSection>

      {/* Comparison */}
      {isLoading && slug1 && slug2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      )}

      {game1 && game2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Headers */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="flex justify-center"><GameHeader game={game1} /></div>
            <div className="text-center text-2xl font-bold text-tertiary pb-3">VS</div>
            <div className="flex justify-center"><GameHeader game={game2} /></div>
          </div>

          {/* Score rings */}
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="flex justify-center">
              <ScoreRing score={game1.score} size={64} strokeWidth={4} />
            </div>
            <div className="text-center text-xs text-tertiary uppercase tracking-wider font-bold">
              Verdict Score
            </div>
            <div className="flex justify-center">
              <ScoreRing score={game2.score} size={64} strokeWidth={4} />
            </div>
          </div>

          {/* Verdict badges */}
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="flex justify-center">
              <VerdictBadge label={game1.verdictLabel} />
            </div>
            <div className="text-center text-xs text-tertiary uppercase tracking-wider font-bold">
              Verdict
            </div>
            <div className="flex justify-center">
              <VerdictBadge label={game2.verdictLabel} />
            </div>
          </div>

          {/* Detail comparison table */}
          <div className="rounded-2xl border border-white/[0.08] bg-surface p-4 md:p-6">
            <CompareCell
              label="Developer"
              v1={game1.developer || "—"}
              v2={game2.developer || "—"}
            />
            <CompareCell
              label="Release"
              v1={formatDate(game1.releaseDate)}
              v2={formatDate(game2.releaseDate)}
            />
            <CompareCell
              label="Genres"
              v1={game1.genres.slice(0, 3).join(", ") || "—"}
              v2={game2.genres.slice(0, 3).join(", ") || "—"}
            />
            <CompareCell
              label="Steam Score"
              v1={game1.userScore ? `${game1.userScore}%` : "—"}
              v2={game2.userScore ? `${game2.userScore}%` : "—"}
              higher={scoreHigher(game1.userScore, game2.userScore)}
            />
            <CompareCell
              label="IGDB Rating"
              v1={game1.igdbRating ? Math.round(game1.igdbRating).toString() : "—"}
              v2={game2.igdbRating ? Math.round(game2.igdbRating).toString() : "—"}
              higher={scoreHigher(game1.igdbRating, game2.igdbRating)}
            />
            <CompareCell
              label="Reviews"
              v1={game1.reviewCount.toLocaleString()}
              v2={game2.reviewCount.toLocaleString()}
              higher={scoreHigher(game1.reviewCount, game2.reviewCount)}
            />
            <CompareCell
              label="Players Now"
              v1={game1.currentPlayers?.toLocaleString() ?? "—"}
              v2={game2.currentPlayers?.toLocaleString() ?? "—"}
              higher={scoreHigher(game1.currentPlayers, game2.currentPlayers)}
            />
            <CompareCell
              label="Price"
              v1={
                game1.isFree ? "Free" :
                game1.priceCurrent != null ? `$${(game1.priceCurrent / 100).toFixed(2)}` : "—"
              }
              v2={
                game2.isFree ? "Free" :
                game2.priceCurrent != null ? `$${(game2.priceCurrent / 100).toFixed(2)}` : "—"
              }
            />
            <CompareCell
              label="Monetization"
              v1={<PixelBadge variant={game1.monetization === "Paid" ? "success" : "accent"} size="sm">{game1.monetization}</PixelBadge>}
              v2={<PixelBadge variant={game2.monetization === "Paid" ? "success" : "accent"} size="sm">{game2.monetization}</PixelBadge>}
            />
            <CompareCell
              label="Platforms"
              v1={game1.platforms.join(", ")}
              v2={game2.platforms.join(", ")}
            />
            {(game1.hltbMain || game2.hltbMain) && (
              <CompareCell
                label="HLTB Main"
                v1={game1.hltbMain ? `${game1.hltbMain}h` : "—"}
                v2={game2.hltbMain ? `${game2.hltbMain}h` : "—"}
              />
            )}
          </div>
        </motion.div>
      )}

      {!slug1 && !slug2 && (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">🎮</div>
          <p className="text-secondary text-sm">
            Search for two games above to compare them
          </p>
        </div>
      )}
    </div>
  );
}
