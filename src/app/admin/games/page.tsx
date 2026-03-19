"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Game } from "@/lib/types";

interface AdminGamesResponse {
  games: Game[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchAdminGames(q: string, page: number): Promise<AdminGamesResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  const res = await fetch(`/api/admin/games?${params}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch games");
}

export default function AdminGamesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const games = useQuery({
    queryKey: ["admin-games", debouncedSearch, page],
    queryFn: () => fetchAdminGames(debouncedSearch, page),
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
      </div>

      {/* Search */}
      <div className="relative">
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {games.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                  </td>
                </tr>
              ))
            ) : games.data?.games.length ? (
              games.data.games.map((game) => (
                <tr key={game.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
                        {game.coverImage && (
                          <Image src={game.coverImage} alt="" fill className="object-cover" sizes="40px" />
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
                    <div className="flex items-center gap-1.5">
                      {game.trending && (
                        <span className="text-[10px] bg-pixel-orange/20 text-pixel-orange px-1.5 py-0.5 rounded font-medium">
                          Trending
                        </span>
                      )}
                      {game.featured && (
                        <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">
                          Featured
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/games/${game.id}`}
                      className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-secondary text-sm">
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
