"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Edit2, Trash2, ExternalLink, Eye, EyeOff, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorialReview {
  id: string;
  game_id: string;
  author_id: string;
  title: string | null;
  content: string;
  score: number | null;
  verdict_label: string | null;
  pros: string[];
  cons: string[];
  playtime_hours: number | null;
  platform_played: string | null;
  version_reviewed: string | null;
  is_published: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  games: {
    id: string;
    title: string;
    slug: string;
    cover_image: string;
  };
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface EditorialReviewsResponse {
  reviews: EditorialReview[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchEditorialReviews(page: number): Promise<EditorialReviewsResponse> {
  const res = await fetch(`/api/admin/editorial-reviews?page=${page}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch editorial reviews");
}

async function deleteEditorialReview(id: string): Promise<void> {
  const res = await fetch(`/api/admin/editorial-reviews/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to delete");
}

async function togglePublish(id: string, isPublished: boolean): Promise<void> {
  const res = await fetch(`/api/admin/editorial-reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_published: isPublished }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to update");
}

async function toggleFeatured(id: string, isFeatured: boolean): Promise<void> {
  const res = await fetch(`/api/admin/editorial-reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_featured: isFeatured }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Failed to update");
}

export default function AdminEditorialPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reviews = useQuery({
    queryKey: ["admin-editorial-reviews", page],
    queryFn: () => fetchEditorialReviews(page),
    staleTime: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEditorialReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-editorial-reviews"] });
      setDeleteId(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      togglePublish(id, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-editorial-reviews"] });
    },
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      toggleFeatured(id, isFeatured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-editorial-reviews"] });
    },
  });

  const totalPages = Math.ceil((reviews.data?.total ?? 0) / (reviews.data?.pageSize ?? 20));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editorial Reviews</h1>
          <p className="text-sm text-secondary mt-0.5">
            {reviews.data?.total ? `${reviews.data.total} editorial review${reviews.data.total !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        <Link
          href="/admin/editorial/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover transition-all"
        >
          <Plus className="w-4 h-4" />
          New Editorial
        </Link>
      </div>

      {/* Reviews List */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {reviews.isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : reviews.data?.reviews.length ? (
          <div className="divide-y divide-border">
            {reviews.data.reviews.map((review) => (
              <div
                key={review.id}
                className="p-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Game Cover */}
                  <Link href={`/game/${review.games.slug}`} className="shrink-0">
                    <div className="w-16 h-20 rounded-lg overflow-hidden bg-surface-2 relative">
                      {review.games.cover_image ? (
                        <Image
                          src={review.games.cover_image}
                          alt={review.games.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-tertiary text-xs">
                          No Image
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Review Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/game/${review.games.slug}`}
                          className="text-sm font-semibold text-foreground hover:text-accent transition-colors line-clamp-1"
                        >
                          {review.games.title}
                        </Link>
                        <p className="text-xs text-tertiary mt-0.5">
                          {review.title || "No title"} • by {review.profiles.display_name || review.profiles.username}
                        </p>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2 shrink-0">
                        {review.is_featured && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Featured
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-medium",
                            review.is_published
                              ? "bg-green-500/20 text-green-400"
                              : "bg-gray-500/20 text-gray-400"
                          )}
                        >
                          {review.is_published ? "Published" : "Draft"}
                        </span>
                      </div>
                    </div>

                    {/* Content Preview */}
                    <p className="text-xs text-secondary mt-2 line-clamp-2">
                      {review.content.slice(0, 200)}...
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-tertiary">
                      {review.score !== null && (
                        <span className="font-bold text-foreground">{review.score}/100</span>
                      )}
                      {review.verdict_label && (
                        <span>{review.verdict_label}</span>
                      )}
                      {review.playtime_hours && (
                        <span>{review.playtime_hours}h played</span>
                      )}
                      {review.platform_played && (
                        <span>on {review.platform_played}</span>
                      )}
                      <span>Updated {new Date(review.updated_at).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => publishMutation.mutate({ id: review.id, isPublished: !review.is_published })}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all",
                          review.is_published
                            ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                            : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        )}
                      >
                        {review.is_published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {review.is_published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => featuredMutation.mutate({ id: review.id, isFeatured: !review.is_featured })}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all",
                          review.is_featured
                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                            : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                        )}
                      >
                        <Star className="w-3 h-3" />
                        {review.is_featured ? "Unfeature" : "Feature"}
                      </button>
                      <Link
                        href={`/admin/editorial/${review.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-all"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </Link>
                      <Link
                        href={`/game/${review.games.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-surface-2 text-secondary hover:text-foreground transition-all"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </Link>
                      <button
                        onClick={() => setDeleteId(review.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-secondary text-sm">
            No editorial reviews yet. Create your first one!
          </div>
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

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Delete Editorial Review?</h3>
            <p className="text-sm text-secondary mt-2">
              This action cannot be undone. The review will be permanently deleted.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-border bg-surface-2 text-secondary hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-danger text-white hover:bg-danger/90 transition-all disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
