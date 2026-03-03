"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getListBySlug } from "@/lib/api";
import GameGrid from "@/components/GameGrid";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";
import { Skeleton, GameGridSkeleton } from "@/components/ui/Skeleton";

interface Props {
  params: Promise<{ slug: string }>;
}

export default function ListDetailPage({ params }: Props) {
  const { slug } = use(params);

  const { data: list, isLoading } = useQuery({
    queryKey: ["list", slug],
    queryFn: () => getListBySlug(slug),
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <GameGridSkeleton count={6} />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-5xl">📋</div>
        <h2 className="text-xl font-bold text-foreground">List not found</h2>
        <p className="text-sm text-secondary">
          This list doesn&apos;t exist or has been removed.
        </p>
        <Link href="/lists">
          <PixelButton variant="secondary">Browse Lists</PixelButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/lists"
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          ← Back to Lists
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {list.title}
        </h1>
        <p className="text-sm text-secondary max-w-2xl leading-relaxed">
          {list.description}
        </p>
        <div className="flex items-center gap-3 text-xs text-tertiary">
          <span>
            Curated by{" "}
            <Link
              href={`/profile/${list.curatedBy}`}
              className="text-accent hover:text-accent-hover font-medium"
            >
              {list.curatedBy}
            </Link>
          </span>
          <span>·</span>
          <span>{list.gameCount} games</span>
          <span>·</span>
          <div className="flex gap-1">
            {list.tags.map((tag) => (
              <PixelBadge key={tag} variant="muted" size="sm">
                {tag}
              </PixelBadge>
            ))}
          </div>
        </div>
      </div>

      {/* Games grid */}
      <GameGrid games={list.games} columns={3} />
    </div>
  );
}
