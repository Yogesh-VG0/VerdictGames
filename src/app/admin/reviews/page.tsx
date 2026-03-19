"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAdminReviews(page: number): Promise<any> {
  const res = await fetch(`/api/admin/reviews?page=${page}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch reviews");
}

async function deleteReview(reviewId: string): Promise<void> {
  const res = await fetch("/api/admin/reviews", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to delete");
}

async function postReview(data: {
  gameId: string;
  rating: number;
  title: string;
  bodyText: string;
  pros?: string[];
  cons?: string[];
}): Promise<void> {
  const res = await fetch("/api/admin/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to post review");
}

/* ── Game search picker helper ── */
interface GamePickerResult {
  id: string;
  title: string;
  coverImage?: string;
  developer?: string;
  score?: number;
}

async function searchGamesForPicker(q: string): Promise<GamePickerResult[]> {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/admin/games?q=${encodeURIComponent(q)}&page=1`);
  const json = await res.json();
  if (!json.success) return [];
  return (json.data.games ?? []).slice(0, 8).map((g: GamePickerResult) => ({
    id: g.id,
    title: g.title,
    coverImage: g.coverImage,
    developer: g.developer,
    score: g.score,
  }));
}

function GameSearchPicker({
  selectedId,
  selectedTitle,
  selectedCover,
  onSelect,
  onClear,
}: {
  selectedId: string;
  selectedTitle: string;
  selectedCover?: string;
  onSelect: (game: GamePickerResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GamePickerResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await searchGamesForPicker(query);
      setResults(res);
      setShowDropdown(true);
      setSearching(false);
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedId) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
        {selectedCover && (
          <div className="w-8 h-11 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
            <Image src={selectedCover} alt="" fill className="object-cover" sizes="32px" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{selectedTitle}</p>
          <p className="text-[10px] text-tertiary font-mono">{selectedId}</p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-tertiary hover:text-danger transition-colors px-2"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search for a game by title..."
          className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 transition-all"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-surface shadow-xl max-h-64 overflow-y-auto">
          {results.map((game) => (
            <button
              key={game.id}
              onClick={() => {
                onSelect(game);
                setQuery("");
                setShowDropdown(false);
              }}
              className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-white/[0.05] transition-colors border-b border-border/50 last:border-b-0"
            >
              {game.coverImage && (
                <div className="w-8 h-11 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
                  <Image src={game.coverImage} alt="" fill className="object-cover" sizes="32px" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{game.title}</p>
                <p className="text-[10px] text-tertiary">{game.developer}</p>
              </div>
              {game.score != null && (
                <span className="text-xs font-bold tabular-nums text-secondary">{game.score}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {showDropdown && !searching && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-surface shadow-xl px-4 py-6 text-center">
          <p className="text-sm text-secondary">No games found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    gameId: "",
    gameTitle: "",
    gameCover: "",
    rating: 75,
    title: "",
    bodyText: "",
    pros: "",
    cons: "",
  });

  const reviews = useQuery({
    queryKey: ["admin-reviews", page],
    queryFn: () => fetchAdminReviews(page),
    staleTime: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      postReview({
        gameId: formData.gameId,
        rating: formData.rating,
        title: formData.title,
        bodyText: formData.bodyText,
        pros: formData.pros ? formData.pros.split("\n").filter(Boolean) : undefined,
        cons: formData.cons ? formData.cons.split("\n").filter(Boolean) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      setShowForm(false);
      setFormData({ gameId: "", gameTitle: "", gameCover: "", rating: 75, title: "", bodyText: "", pros: "", cons: "" });
    },
  });

  const totalPages = Math.ceil((reviews.data?.total ?? 0) / (reviews.data?.pageSize ?? 20));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
          <p className="text-sm text-secondary mt-0.5">
            Moderate reviews or write new ones
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover transition-all"
        >
          {showForm ? "Cancel" : "Write Review"}
        </button>
      </div>

      {/* Write Review Form */}
      {showForm && (
        <div className="rounded-2xl border border-accent/20 bg-surface p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground">New Review</h2>

          {/* Game picker + Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
                Game
              </label>
              <GameSearchPicker
                selectedId={formData.gameId}
                selectedTitle={formData.gameTitle}
                selectedCover={formData.gameCover}
                onSelect={(game) =>
                  setFormData((f) => ({
                    ...f,
                    gameId: game.id,
                    gameTitle: game.title,
                    gameCover: game.coverImage ?? "",
                  }))
                }
                onClear={() =>
                  setFormData((f) => ({
                    ...f,
                    gameId: "",
                    gameTitle: "",
                    gameCover: "",
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Rating (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={formData.rating}
                onChange={(e) => setFormData((f) => ({ ...f, rating: parseInt(e.target.value, 10) || 0 }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Review Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Body</label>
            <textarea
              value={formData.bodyText}
              onChange={(e) => setFormData((f) => ({ ...f, bodyText: e.target.value }))}
              rows={5}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all resize-y"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Pros (one per line)</label>
              <textarea
                value={formData.pros}
                onChange={(e) => setFormData((f) => ({ ...f, pros: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-pixel-green/50 transition-all resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Cons (one per line)</label>
              <textarea
                value={formData.cons}
                onChange={(e) => setFormData((f) => ({ ...f, cons: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-danger/50 transition-all resize-y"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => postMutation.mutate()}
              disabled={postMutation.isPending || !formData.gameId || !formData.title}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-pixel-green text-black hover:bg-pixel-green/80 transition-all disabled:opacity-50"
            >
              {postMutation.isPending ? "Posting..." : "Publish Review"}
            </button>
          </div>
          {postMutation.isError && (
            <p className="text-xs text-danger">{(postMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-3">
        {reviews.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
          ))
        ) : reviews.data?.reviews?.length ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reviews.data.reviews.map((review: any) => (
            <div
              key={review.id}
              className="rounded-2xl border border-border bg-surface p-4 hover:border-border-hover transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {review.games?.cover_image && (
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
                      <Image src={review.games.cover_image} alt="" fill className="object-cover" sizes="40px" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{review.title}</p>
                    <p className="text-[11px] text-tertiary">
                      {review.games?.title} • by {review.profiles?.username} • {review.rating}/100
                    </p>
                    <p className="text-xs text-secondary mt-1 line-clamp-2">{review.body}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete this review?")) {
                      deleteMutation.mutate(review.id);
                    }
                  }}
                  className="shrink-0 text-[10px] text-danger hover:text-danger/80 font-medium px-2 py-1 rounded border border-danger/20 hover:bg-danger/10 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-secondary text-sm text-center py-8">No reviews yet</p>
        )}
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
          <span className="text-xs text-tertiary">Page {page} of {totalPages}</span>
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

