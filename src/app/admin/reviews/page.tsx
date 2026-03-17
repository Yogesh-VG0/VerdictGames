"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    gameId: "",
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
      setFormData({ gameId: "", rating: 75, title: "", bodyText: "", pros: "", cons: "" });
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Game ID</label>
              <input
                type="text"
                value={formData.gameId}
                onChange={(e) => setFormData((f) => ({ ...f, gameId: e.target.value }))}
                placeholder="UUID of the game"
                className="w-full rounded-xl border border-white/[0.08] bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 transition-all"
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
                className="w-full rounded-xl border border-white/[0.08] bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Review Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-white/[0.08] bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Body</label>
            <textarea
              value={formData.bodyText}
              onChange={(e) => setFormData((f) => ({ ...f, bodyText: e.target.value }))}
              rows={5}
              className="w-full rounded-xl border border-white/[0.08] bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all resize-y"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Pros (one per line)</label>
              <textarea
                value={formData.pros}
                onChange={(e) => setFormData((f) => ({ ...f, pros: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-white/[0.08] bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-pixel-green/50 transition-all resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Cons (one per line)</label>
              <textarea
                value={formData.cons}
                onChange={(e) => setFormData((f) => ({ ...f, cons: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-white/[0.08] bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-danger/50 transition-all resize-y"
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
              className="rounded-2xl border border-white/[0.08] bg-surface p-4 hover:border-white/[0.12] transition-all"
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
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-surface text-secondary hover:text-foreground disabled:opacity-30 transition-all"
          >
            ← Prev
          </button>
          <span className="text-xs text-tertiary">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-surface text-secondary hover:text-foreground disabled:opacity-30 transition-all"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
