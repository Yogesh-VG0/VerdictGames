"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageOff, AlertTriangle, Clock, Database, Star, FileText, Tag, Video, ShoppingBag, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import type { Game } from "@/lib/types";

// Quality filter definitions with icons and labels
const QUALITY_FILTERS = [
  { key: "missing-cover", label: "Missing Cover", icon: ImageOff, color: "text-red-400" },
  { key: "missing-header", label: "Missing Header", icon: ImageOff, color: "text-orange-400" },
  { key: "missing-screenshots", label: "No Screenshots", icon: ImageOff, color: "text-yellow-400" },
  { key: "missing-description", label: "No Description", icon: FileText, color: "text-yellow-400" },
  { key: "missing-genres", label: "No Genres", icon: Tag, color: "text-blue-400" },
  { key: "missing-tags", label: "No Tags", icon: Tag, color: "text-blue-300" },
  { key: "missing-trailer", label: "No Trailer", icon: Video, color: "text-purple-400" },
  { key: "missing-store-link", label: "No Store Link", icon: ShoppingBag, color: "text-pink-400" },
  { key: "low-confidence", label: "Low Confidence", icon: AlertTriangle, color: "text-orange-500" },
  { key: "provisional", label: "Provisional", icon: Clock, color: "text-amber-400" },
  { key: "stale-enrichment", label: "Stale (>30d)", icon: Clock, color: "text-gray-400" },
  { key: "no-provider", label: "No Provider", icon: Database, color: "text-red-300" },
  { key: "zero-reviews", label: "Zero Reviews", icon: Star, color: "text-gray-500" },
] as const;

type QualityFilter = typeof QUALITY_FILTERS[number]["key"];
type SortOption = "updated" | "confidence" | "reviews" | "completeness";

interface AdminGame extends Game {
  enrichmentSources: string[];
  hasTrailer: boolean;
  hasStoreLink: boolean;
  createdAt: string;
  updatedAt: string;
  enrichedAt: string | null;
  completenessScore: number;
  mediaSource: string | null;
}

interface AdminGamesResponse {
  games: AdminGame[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchAdminGames(q: string, page: number, filter: QualityFilter | null, sort: SortOption): Promise<AdminGamesResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  if (filter) params.set("filter", filter);
  params.set("sort", sort);
  const res = await fetch(`/api/admin/games?${params}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch games");
}

export default function AdminGamesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<QualityFilter | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const handleFilterClick = (key: QualityFilter) => {
    setActiveFilter((prev) => (prev === key ? null : key));
    setPage(1);
  };

  const games = useQuery({
    queryKey: ["admin-games", debouncedSearch, page, activeFilter, sortBy],
    queryFn: () => fetchAdminGames(debouncedSearch, page, activeFilter, sortBy),
    staleTime: 10_000,
  });

  const totalPages = Math.ceil((games.data?.total ?? 0) / (games.data?.pageSize ?? 20));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Games</h1>
          <p className="text-sm text-secondary mt-0.5">
            {games.data?.total ? `${games.data.total.toLocaleString()} games in database` : "Loading..."}
          </p>
        </div>
        <Link
          href="/admin/games/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          ➕ Add Game
        </Link>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search games by title..."
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
          {games.isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value as SortOption); setPage(1); }}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all"
        >
          <option value="updated">Sort: Recently Updated</option>
          <option value="confidence">Sort: Lowest Confidence</option>
          <option value="reviews">Sort: Fewest Reviews</option>
          <option value="completeness">Sort: Least Complete</option>
        </select>
      </div>

      {/* Quality Filter Chips */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-secondary uppercase tracking-wider">Quality Filters</p>
        <div className="flex flex-wrap gap-2">
          {QUALITY_FILTERS.map(({ key, label, icon: Icon, color }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => handleFilterClick(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-secondary hover:text-foreground hover:bg-white/5 border border-border"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : color}`} />
                {label}
              </button>
            );
          })}
          {activeFilter && (
            <button
              onClick={() => { setActiveFilter(null); setPage(1); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
            >
              <XCircle className="w-3.5 h-3.5" />
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Games — Mobile Cards / Desktop Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">

        {/* ── Mobile/Tablet: Stacked Cards ── */}
        <div className="md:hidden divide-y divide-border">
          {games.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ))
          ) : games.data?.games.length ? (
            games.data.games.map((game) => (
              <Link
                key={game.id}
                href={`/admin/games/${game.id}`}
                className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors active:bg-white/[0.04]"
              >
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
                  {game.coverImage && (
                    <Image src={game.coverImage} alt="" fill className="object-cover" sizes="48px" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{game.title}</p>
                  <p className="text-[11px] text-tertiary mt-0.5">{game.developer} • {game.releaseDate?.split("-")[0]}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-bold tabular-nums text-foreground">{game.score}</span>
                    <span className="text-[10px] text-tertiary">{game.verdictLabel}</span>
                    {game.trending && (
                      <span className="text-[9px] bg-pixel-orange/20 text-pixel-orange px-1.5 py-0.5 rounded font-medium">
                        Trending
                      </span>
                    )}
                    {game.featured && (
                      <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">
                        Featured
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-secondary text-sm">
              No games found
            </div>
          )}
        </div>

        {/* ── Desktop: Table ── */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Game</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Quality</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden xl:table-cell">Sources</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {games.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                  </td>
                </tr>
              ))
            ) : games.data?.games.length ? (
              games.data.games.map((game) => {
                // Compute confidence color
                const conf = game.confidence ?? 0;
                const confColor = conf >= 0.7 ? "text-green-400" : conf >= 0.4 ? "text-yellow-400" : conf >= 0.2 ? "text-orange-400" : "text-red-400";
                const confBg = conf >= 0.7 ? "bg-green-500/10" : conf >= 0.4 ? "bg-yellow-500/10" : conf >= 0.2 ? "bg-orange-500/10" : "bg-red-500/10";
                
                return (
                <tr key={game.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
                        {game.coverImage ? (
                          <Image src={game.coverImage} alt="" fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-4 h-4 text-red-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{game.title}</p>
                        <p className="text-[11px] text-tertiary">{game.developer} • {game.releaseDate?.split("-")[0]}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold tabular-nums">{game.score}</span>
                    <span className="text-[10px] text-tertiary ml-1">{game.verdictLabel}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      {/* Confidence badge */}
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${confBg} ${confColor}`}>
                        {(conf * 100).toFixed(0)}% conf
                      </span>
                      {/* Status badges */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {game.trending && (
                          <span className="text-[9px] bg-pixel-orange/20 text-pixel-orange px-1 py-0.5 rounded font-medium">T</span>
                        )}
                        {game.featured && (
                          <span className="text-[9px] bg-accent/20 text-accent px-1 py-0.5 rounded font-medium">F</span>
                        )}
                        {!game.coverImage && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-medium">!img</span>
                        )}
                        {!game.hasTrailer && (
                          <span className="text-[9px] bg-purple-500/10 text-purple-300 px-1 py-0.5 rounded font-medium">!vid</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex items-center gap-1 flex-wrap">
                      {game.enrichmentSources?.length > 0 ? (
                        game.enrichmentSources.slice(0, 3).map((src) => (
                          <span key={src} className="text-[9px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded font-medium uppercase">
                            {src.slice(0, 4)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] text-tertiary">none</span>
                      )}
                      {game.hasStoreLink && (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/game/${game.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-secondary hover:text-foreground font-medium transition-colors"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/admin/games/${game.id}`}
                        className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-secondary text-sm">
                  No games found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-secondary hover:text-foreground disabled:opacity-30 transition-all"
          >
            ← Prev
          </button>
          <span className="text-xs text-tertiary">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-secondary hover:text-foreground disabled:opacity-30 transition-all"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
