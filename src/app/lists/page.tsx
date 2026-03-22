"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getCuratedLists } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import PixelBadge from "@/components/ui/PixelBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ListPlus, Loader2 } from "lucide-react";

const gridItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export default function ListsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "mine">("all");

  const { data: lists, isLoading } = useQuery({
    queryKey: ["lists"],
    queryFn: getCuratedLists,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/seed-lists", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Seed failed");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const myLists = lists?.filter((l) => l.ownerId === user?.profileId) ?? [];
  const displayLists = tab === "mine" ? myLists : lists;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-bold text-foreground">Curated Lists</h1>
        <p className="text-sm text-secondary">
          Hand-picked collections by the community. Discover your next game through thoughtfully organized lists.
        </p>
      </motion.div>

      {/* Tabs */}
      {user && (
        <div className="flex gap-2">
          {[
            { id: "all" as const, label: "All Lists" },
            { id: "mine" as const, label: "My Lists" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "bg-surface border border-border text-secondary hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : displayLists && displayLists.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>*:last-child:nth-child(3n-2)]:sm:col-start-1 [&>*:last-child:nth-child(3n-2)]:lg:col-start-2"
        >
          {displayLists.map((list) => (
            <motion.div key={list.id} variants={gridItem}>
            <Link
              href={`/lists/${list.slug}`}
              className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-border-hover hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 block"
            >
              <div className="relative aspect-video overflow-hidden">
                {list.coverImage ? (
                  <Image
                    src={list.coverImage}
                    alt={list.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <ListPlus className="w-8 h-8 text-tertiary" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-2 left-2">
                  <PixelBadge variant="accent" size="sm">
                    {list.gameCount} games
                  </PixelBadge>
                </div>
              </div>
              <div className="p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1">
                  {list.title}
                </h3>
                <p className="text-xs text-secondary line-clamp-2">
                  {list.description}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-tertiary">
                  <span>by {list.curatedBy}</span>
                  <span>·</span>
                  <div className="flex gap-1">
                    {list.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-16 space-y-4 rounded-2xl border border-border bg-surface">
          <ListPlus className="w-10 h-10 text-accent mx-auto" />
          <p className="text-foreground font-semibold text-lg">No Lists Yet</p>
          <p className="text-sm text-secondary max-w-md mx-auto">
            Editorial collections will appear here once curated. Explore games by genre or platform in the meantime.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link href="/search?sort=top-rated" className="px-4 py-2 text-sm font-medium text-accent border border-accent/30 rounded-xl hover:bg-accent/10 transition-colors">
              Browse Top Rated
            </Link>
            <Link href="/search?sort=trending" className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors">
              Explore Trending
            </Link>
          </div>
          {/* Admin-only seed button */}
          {user?.role === "admin" && (
            <div className="pt-4 border-t border-border mt-4 mx-auto max-w-xs">
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 rounded-xl hover:bg-pixel-cyan/20 transition-all disabled:opacity-50"
              >
                {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                {seedMutation.isPending ? "Seeding..." : "Seed Editorial Lists"}
              </button>
              {seedMutation.isSuccess && (
                <p className="text-xs text-pixel-green mt-2">Lists seeded! Refreshing...</p>
              )}
              {seedMutation.isError && (
                <p className="text-xs text-danger mt-2">Failed to seed lists.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
