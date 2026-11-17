"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getListBySlug, getOwnedListBySlug } from "@/lib/api";
import { useAuth } from '@/hooks/useAuth';
import type { GameList } from "@/lib/types";
import GameGrid from "@/components/GameGrid";
import PixelBadge from "@/components/ui/PixelBadge";
import PixelButton from "@/components/ui/PixelButton";
import { Skeleton, GameGridSkeleton } from "@/components/ui/Skeleton";

interface Props {
  slug: string;
  initialList: GameList;
  privateOwner?: string;
}

export default function ListDetailClientPage({ slug, initialList, privateOwner }: Props) {
  const {user,loading:authLoading}=useAuth();
  const ownerMatches=!privateOwner||user?.id===privateOwner;

  const { data: list, isLoading, isError, refetch } = useQuery({
    queryKey: privateOwner?["privateLists","detail",user?.id,slug]:["list", slug],
    queryFn: () => privateOwner?getOwnedListBySlug(slug):getListBySlug(slug),
    initialData: ownerMatches?initialList:undefined,
    enabled: ownerMatches,
    gcTime: privateOwner?0:undefined,
  });

  if (isLoading || privateOwner && authLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <GameGridSkeleton count={6} />
      </div>
    );
  }

  if(ownerMatches&&isError){
    return <div role="alert" className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
      <h2 className="text-xl font-bold text-foreground">List temporarily unavailable</h2>
      <PixelButton onClick={()=>void refetch()}>Retry</PixelButton>
    </div>;
  }
  if (!ownerMatches || !list) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-5xl">📋</div>
        <h2 className="text-xl font-bold text-foreground">List not found</h2>
        <p className="text-sm text-secondary">
          This list doesn&apos;t exist or has been removed.
        </p>
        <Link href="/lists" prefetch={false}>
          <PixelButton as="span" variant="secondary">Browse Lists</PixelButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/lists"
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          ← Back to Lists
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words">
          {list.title}
        </h1>
        <p className="text-sm text-secondary max-w-2xl leading-relaxed break-words">
          {list.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-tertiary flex-wrap">
          <span className="shrink-0">
            Curated by{" "}
            <Link
              href={`/profile/${list.curatedBy}`}
              className="text-accent hover:text-accent-hover font-medium"
            >
              {list.curatedBy}
            </Link>
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="shrink-0">{list.gameCount} games</span>
          <div className="flex gap-1 flex-wrap basis-full sm:basis-auto">
            {list.tags.slice(0, 3).map((tag) => (
              <PixelBadge key={tag} variant="muted" size="sm">
                {tag}
              </PixelBadge>
            ))}
          </div>
        </div>
      </div>

      {/* Games grid */}
      <GameGrid games={list.games} columns={4} />
    </div>
  );
}
