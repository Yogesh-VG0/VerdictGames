"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, getUserReviews, toggleFollow } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, cn } from "@/lib/utils";
import ReviewCard from "@/components/ReviewCard";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";
import Tabs from "@/components/ui/Tabs";
import AuthModal from "@/components/AuthModal";
import { Skeleton, ReviewCardSkeleton } from "@/components/ui/Skeleton";

interface Props {
  params: Promise<{ username: string }>;
}

export default function ProfilePage({ params }: Props) {
  const { username } = use(params);
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: () => getUserProfile(username),
  });

  const { data: reviews } = useQuery({
    queryKey: ["userReviews", username],
    queryFn: () => getUserReviews(username),
    enabled: !!user,
  });

  const followMutation = useMutation({
    mutationFn: (action: "follow" | "unfollow") => toggleFollow(user?.id ?? "", action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", username] });
    },
  });

  const isOwnProfile = currentUser?.username === username;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-5xl">👤</div>
        <h2 className="text-xl font-bold text-foreground">User not found</h2>
        <p className="text-sm text-secondary">
          This profile doesn&apos;t exist.
        </p>
        <Link href="/">
          <PixelButton variant="secondary">Back to Home</PixelButton>
        </Link>
      </div>
    );
  }

  const tabs = [
    {
      id: "activity",
      label: "Activity",
      content: (
        <div className="space-y-3">
          {user.recentActivity.length > 0 ? (
            user.recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 text-sm py-2 border-b border-white/[0.06] last:border-0"
              >
                <span className="text-lg">
                  {item.type === "review" ? "📝" : item.type === "list" ? "📋" : item.type === "library" ? "📚" : "⭐"}
                </span>
                <div className="flex-1 min-w-0">
                  {item.type === "review" && (
                    <p className="text-foreground">
                      Reviewed{" "}
                      <Link
                        href={`/game/${item.gameSlug}`}
                        className="text-accent hover:text-accent-hover font-medium"
                      >
                        {item.gameTitle}
                      </Link>
                      {item.rating && (
                        <span className="text-secondary"> — {item.rating}/100</span>
                      )}
                    </p>
                  )}
                  {item.type === "list" && (
                    <p className="text-foreground">
                      Created list{" "}
                      <Link
                        href={`/lists/${item.listSlug}`}
                        className="text-accent hover:text-accent-hover font-medium"
                      >
                        {item.listTitle}
                      </Link>
                    </p>
                  )}
                  {item.type === "rating" && (
                    <p className="text-foreground">
                      Rated{" "}
                      <Link
                        href={`/game/${item.gameSlug}`}
                        className="text-accent hover:text-accent-hover font-medium"
                      >
                        {item.gameTitle}
                      </Link>
                      <span className="text-secondary"> — {item.rating}/100</span>
                    </p>
                  )}
                  <time className="text-xs text-tertiary">
                    {formatDate(item.createdAt)}
                  </time>
                </div>
              </div>
            ))
          ) : (
            <p className="text-secondary text-sm text-center py-8">
              No recent activity.
            </p>
          )}
        </div>
      ),
    },
    {
      id: "reviews",
      label: "Reviews",
      content: (
        <div className="space-y-4">
          {reviews && reviews.length > 0 ? (
            reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <p className="text-secondary text-sm text-center py-8">
              No reviews yet.
            </p>
          )}
        </div>
      ),
    },
    {
      id: "lists",
      label: "Lists",
      content: (
        <p className="text-secondary text-sm text-center py-8">
          Lists feature coming soon.
        </p>
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="flex items-start gap-4 md:gap-6">
        <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-white/[0.1] shrink-0">
          <Image
            src={user.avatar}
            alt={user.displayName}
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {user.displayName}
            </h1>
            {!isOwnProfile && (
              <button
                onClick={() => {
                  if (!currentUser) {
                    setAuthModalOpen(true);
                    return;
                  }
                  followMutation.mutate("follow");
                }}
                disabled={followMutation.isPending}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all disabled:opacity-50"
              >
                {followMutation.isPending ? "..." : "Follow"}
              </button>
            )}
          </div>
          <p className="text-xs text-tertiary">@{user.username}</p>
          <p className="text-sm text-secondary">{user.bio}</p>
          {/* Follower/Following counts */}
          <div className="flex items-center gap-4 text-xs pt-1">
            <span className="text-secondary">
              <span className="font-bold text-foreground">{user.followerCount ?? 0}</span> followers
            </span>
            <span className="text-secondary">
              <span className="font-bold text-foreground">{user.followingCount ?? 0}</span> following
            </span>
            {user.libraryCount != null && user.libraryCount > 0 && (
              <span className="text-secondary">
                <span className="font-bold text-foreground">{user.libraryCount}</span> in library
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {user.favoriteGenres.map((g) => (
              <PixelBadge key={g} variant="muted" size="sm">
                {g}
              </PixelBadge>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Reviews", value: user.gamesReviewed },
          { label: "Lists", value: user.listsCreated },
          { label: "Member since", value: formatDate(user.joinedAt) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/[0.08] bg-surface p-3 text-center"
          >
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-tertiary uppercase tracking-wider">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="activity" />

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
