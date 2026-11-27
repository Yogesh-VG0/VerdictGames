"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { compareGames, searchGames, getGameBySlug } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import PlatformIcon from "@/components/ui/PlatformIcon";
import ScoreRing from "@/components/ui/ScoreRing";
import VerdictBadge from "@/components/ui/VerdictBadge";
import PixelBadge from "@/components/ui/PixelBadge";
import FadeInSection from "@/components/FadeInSection";
import SafeImage from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Game } from "@/lib/types";
import { Swords, Gamepad2 } from "lucide-react";
import GradientText from "@/components/ui/GradientText";

function CompareCell({ label, v1, v2, higher = "none" }: {
  label: string;
  v1: React.ReactNode;
  v2: React.ReactNode;
  higher?: "left" | "right" | "none";
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-3 border-b border-border last:border-0 items-center">
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

function GameSearchInput({ value, selectedTitle, onSelect, placeholder, inputId, inputName }: {
  value: string;
  selectedTitle?: string;
  onSelect: (slug: string) => void;
  placeholder: string;
  inputId: string;
  inputName: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching, isError, refetch } = useQuery({
    queryKey: ["compareSearch", debouncedQuery],
    queryFn: () => searchGames({ query: debouncedQuery, page: 1 }),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 30_000,
  });
  const suggestions = results?.items.slice(0, 6) ?? [];
  const choose = (game: Game) => { onSelect(game.slug); setQuery(game.title); setOpen(false); setActive(-1); };

  return (
    <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        id={inputId}
        name={inputName}
        type="text"
        value={open ? query : selectedTitle ?? value}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => { setQuery(selectedTitle ?? value); setOpen(true); }}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={open && suggestions.length ? `${inputId}-options` : undefined}
        aria-busy={isFetching}
        aria-expanded={open && suggestions.length > 0}
        aria-activedescendant={open && active >= 0 ? `${inputId}-option-${active}` : undefined}
        autoComplete="off"
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1); }
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
            event.preventDefault(); setOpen(true);
            setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
          }
          if (event.key === 'Enter' && open && active >= 0 && suggestions[active]) { event.preventDefault(); choose(suggestions[active]); }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-11 px-4 text-sm rounded-xl bg-surface border border-border text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
      />
      {open && isFetching && <p role="status" className="mt-2 text-xs text-secondary">Searching games…</p>}
      {open && isError && <p role="alert" className="mt-2 text-sm text-secondary">Search could not be loaded. <button onClick={() => refetch()} className="underline">Try again</button></p>}
      {open && !isFetching && !isError && debouncedQuery.length >= 2 && results && !suggestions.length && <p role="status" className="mt-2 text-sm text-secondary">No matching games. Try another title.</p>}
      {open && results && results.items.length > 0 && (
        <div id={`${inputId}-options`} role="listbox" aria-label={placeholder} className="absolute top-full mt-1 left-0 right-0 z-50 max-h-60 overflow-auto rounded-xl bg-surface border border-border shadow-2xl">
          {suggestions.map((g, index) => (
            <button
              key={g.id}
              type="button"
              role="option"
              id={`${inputId}-option-${index}`}
              aria-selected={active === index}
              tabIndex={-1}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(g)}
              className={cn('flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-surface-2 transition-colors', active === index && 'bg-elevated')}
            >
              <div className="relative w-8 h-11 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                {g.coverImage ? (
                  <SafeImage src={g.coverImage} alt={g.title} fill sizes="32px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-tertiary"><Gamepad2 className="w-3.5 h-3.5" /></div>
                )}
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
      <div className="relative w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden border border-border group-hover:border-accent/40 transition-colors bg-surface-2">
        {game.coverImage ? (
          <SafeImage src={game.coverImage} alt={game.title} fill sizes="112px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-tertiary"><Gamepad2 className="w-6 h-6" /></div>
        )}
      </div>
      <h3 className="text-sm font-bold text-foreground text-center group-hover:text-accent transition-colors line-clamp-2">
        {game.title}
      </h3>
    </Link>
  );
}

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const g1 = searchParams.get("g1") ?? "";
  const g2 = searchParams.get("g2") ?? "";

  const slug1 = g1;
  const slug2 = g2;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["compare", slug1, slug2],
    queryFn: () => compareGames(slug1, slug2),
    enabled: slug1.length > 0 && slug2.length > 0,
  });
  const single = useQuery({
    queryKey: ['game', slug1 || slug2],
    queryFn: () => getGameBySlug(slug1 || slug2),
    enabled: Boolean(slug1 || slug2) && !(slug1 && slug2),
    staleTime: 300000,
  });

  function handleSelect(side: 1 | 2, slug: string) {
    const next1 = side === 1 ? slug : slug1;
    const next2 = side === 2 ? slug : slug2;
    const params = new URLSearchParams();
    if (next1) params.set('g1', next1);
    if (next2) params.set('g2', next2);
    router.replace(`/compare?${params}`, { scroll: false });
  }

  const game1 = data?.game1;
  const game2 = data?.game2;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 page-enter">
      <FadeInSection>
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center justify-center gap-3">
            <Swords className="w-6 h-6 text-sky-500" />
            <GradientText text="Game Comparison" gradient="linear-gradient(90deg, #0ea5e9 0%, #38bdf8 25%, #7dd3fc 50%, #38bdf8 75%, #0ea5e9 100%)" />
          </h1>
          <p className="text-sm text-secondary">
            Compare two games side-by-side
          </p>
        </div>
      </FadeInSection>

      {/* Search inputs */}
      <FadeInSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GameSearchInput key={`first-${g1}`} value={g1} selectedTitle={game1?.title ?? (slug1 ? single.data?.title : undefined)} onSelect={(s) => handleSelect(1, s)} placeholder="Search first game..." inputId="compare-first-game" inputName="firstGame" />
          <GameSearchInput key={`second-${g2}`} value={g2} selectedTitle={game2?.title ?? (slug2 ? single.data?.title : undefined)} onSelect={(s) => handleSelect(2, s)} placeholder="Search second game..." inputId="compare-second-game" inputName="secondGame" />
        </div>
      </FadeInSection>

      {/* Comparison */}
      {Boolean(slug1 || slug2) && !(slug1 && slug2) && <section aria-label="Selected comparison game" className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        {single.isLoading ? <p role="status">Loading selected game…</p> : single.data ? <><GameHeader game={single.data} /><p className="text-center text-sm text-secondary">Choose a {slug1 ? 'second' : 'first'} game above to compare.</p></> : <p role="alert">The selected game could not be loaded. <button onClick={() => single.refetch()} className="underline">Try again</button></p>}
      </section>}
      {isError && <p role="alert">Comparison could not be loaded. <button onClick={() => refetch()} className="underline">Try again</button></p>}
      {slug1 && slug2 && data === null && <p role="status">One or both games are no longer available to compare.</p>}
      {isLoading && slug1 && slug2 && (
        <div role="status" aria-label="Loading comparison" aria-busy="true" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      )}

      {game1 && game2 && (
        <motion.div
          initial={false}
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
          <div className="rounded-2xl border border-border bg-surface p-4 md:p-6">
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
                game1.priceCurrent != null && game1.priceCurrency
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: game1.priceCurrency, minimumFractionDigits: 2 }).format(game1.priceCurrent / 100)
                  : game1.priceDealUrl ? "View deal" : "—"
              }
              v2={
                game2.isFree ? "Free" :
                game2.priceCurrent != null && game2.priceCurrency
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: game2.priceCurrency, minimumFractionDigits: 2 }).format(game2.priceCurrent / 100)
                  : game2.priceDealUrl ? "View deal" : "—"
              }
            />
            <CompareCell
              label="Monetization"
              v1={<PixelBadge variant={game1.monetization === "Paid" ? "success" : "accent"} size="sm">{game1.monetization}</PixelBadge>}
              v2={<PixelBadge variant={game2.monetization === "Paid" ? "success" : "accent"} size="sm">{game2.monetization}</PixelBadge>}
            />
            <CompareCell
              label="Platforms"
              v1={
                <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                  {game1.platforms.slice(0, 4).map((p) => (
                    <span key={p} title={p}><PlatformIcon platform={p} size={14} /></span>
                  ))}
                  {game1.platforms.length > 4 && <span className="text-[10px] text-tertiary">+{game1.platforms.length - 4}</span>}
                </span>
              }
              v2={
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  {game2.platforms.slice(0, 4).map((p) => (
                    <span key={p} title={p}><PlatformIcon platform={p} size={14} /></span>
                  ))}
                  {game2.platforms.length > 4 && <span className="text-[10px] text-tertiary">+{game2.platforms.length - 4}</span>}
                </span>
              }
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
          <Gamepad2 className="w-10 h-10 text-accent mx-auto" />
          <p className="text-secondary text-sm">
            Search for two games above to compare them
          </p>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          <Skeleton className="h-10 w-64 mx-auto" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
