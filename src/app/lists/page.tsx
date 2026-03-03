"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getCuratedLists } from "@/lib/api";
import PixelBadge from "@/components/ui/PixelBadge";
import { Skeleton } from "@/components/ui/Skeleton";

const gridItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export default function ListsPage() {
  const { data: lists, isLoading } = useQuery({
    queryKey: ["lists"],
    queryFn: getCuratedLists,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-sm border border-border overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : lists && lists.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {lists.map((list) => (
            <motion.div key={list.id} variants={gridItem}>
            <Link
              href={`/lists/${list.slug}`}
              className="group rounded-sm border border-border bg-surface overflow-hidden pixel-corners hover:border-border-hover hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 block"
            >
              <div className="relative aspect-video overflow-hidden">
                <Image
                  src={list.coverImage}
                  alt={list.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
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
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl">📋</div>
          <p className="text-foreground font-semibold">No lists yet</p>
          <p className="text-sm text-secondary">
            Check back soon for curated game collections.
          </p>
        </div>
      )}
    </div>
  );
}
