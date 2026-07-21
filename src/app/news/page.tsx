"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Newspaper, Filter, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getGXPopularNews, getGXNewsFeed } from "@/lib/api";
import type { GXNewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import GradientText from "@/components/ui/GradientText";
import HeroImage from "@/components/ui/HeroImage";
import SafeImage from "@/components/ui/SafeImage";

export default function NewsPage() {
  const [selectedPublisher, setSelectedPublisher] = useState("All");

  // The API routes provide a shared five-minute CDN cache.
  const { data: articles, isLoading } = useQuery({
    queryKey: ["gx-news-full"],
    queryFn: async () => {
      const results = await Promise.allSettled([
        getGXPopularNews(),
        getGXNewsFeed(),
      ]);
      const available = results
        .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof getGXPopularNews>>> => result.status === "fulfilled")
        .map((result) => result.value);
      if (available.length === 0) {
        throw new Error("Gaming news is temporarily unavailable.");
      }
      const [popular = [], feed = []] = available;
      // Dedupe by normalized title, popular items first
      // ALSO filter out articles without images (user requirement: don't show imageless news)
      const seen = new Set<string>();
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const merged: GXNewsItem[] = [];
      for (const a of [...popular, ...feed]) {
        // Skip articles without images
        if (!a.image || a.image.trim() === "") continue;
        const key = normalize(a.title);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(a);
        }
      }
      return merged;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  // Extract unique publishers
  const publishers = useMemo(() => {
    if (!articles) return [];
    const set = new Set<string>();
    articles.forEach((a) => set.add(a.publisherName));
    return Array.from(set).sort();
  }, [articles]);

  // Filter
  const filtered = useMemo(() => {
    if (!articles) return [];
    if (selectedPublisher === "All") return articles;
    return articles.filter((a) => a.publisherName === selectedPublisher);
  }, [articles, selectedPublisher]);

  const featured = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 sm:py-8 space-y-8 page-enter">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-tertiary mb-3">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <Newspaper className="w-7 h-7 text-accent" />
          <GradientText
            text="Gaming News"
            gradient="linear-gradient(90deg, #14b8a6 0%, #06b6d4 25%, #3b82f6 50%, #06b6d4 75%, #14b8a6 100%)"
          />
        </h1>
        <p className="text-sm text-secondary">
          Trending stories from top gaming outlets — refreshed every five minutes
        </p>
      </div>

      {/* Publisher filter chips */}
      {publishers.length > 1 && (
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-tertiary font-medium flex items-center gap-1.5">
            <Filter className="w-3 h-3" />
            Source
          </label>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedPublisher("All")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                selectedPublisher === "All"
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
              )}
            >
              All Sources
            </button>
            {publishers.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPublisher(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                  selectedPublisher === p
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-tertiary">
          {isLoading
            ? "Loading news…"
            : `${filtered.length} article${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface overflow-hidden"
              >
                <div className="aspect-video bg-surface-2 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-surface-2 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-surface-2 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="w-24 h-16 bg-surface-2 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-surface-2 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-surface-2 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured hero articles */}
      {!isLoading && featured.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featured.map((article, idx) => (
            <motion.a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group block rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/30 hover:shadow-lg transition-all"
            >
              <div className="relative aspect-video overflow-hidden">
                {article.image ? (
                  <HeroImage
                    src={article.image}
                    alt={article.title}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="group-hover:scale-105 transition-transform duration-500"
                    fallbackClassName="bg-surface-2"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent/20 to-pixel-cyan/20 flex items-center justify-center">
                    <Newspaper className="w-8 h-8 text-accent/60" />
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground line-clamp-2 group-hover:text-accent transition-colors leading-snug">
                  {article.title}
                </h3>
                <div className="flex items-center gap-2">
                  {article.publisherFavicon && (
                    <SafeImage
                      src={article.publisherFavicon}
                      alt=""
                      width={14}
                      height={14}
                      className="rounded-sm"
                    />
                  )}
                  <span className="text-xs text-tertiary">
                    {article.publisherName}
                  </span>
                </div>
                {/* Related stories */}
                {article.related && article.related.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {article.related.slice(0, 3).map((rel) => (
                      <span
                        key={rel.url}
                        className="text-[9px] text-tertiary bg-surface-2 px-2 py-0.5 rounded-full border border-border"
                      >
                        {rel.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.a>
          ))}
        </div>
      )}

      {/* Rest of articles in compact list */}
      {!isLoading && rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((article, i) => (
            <motion.a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.3 }}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-accent/30 hover:bg-surface-2 transition-all"
            >
              <div className="relative w-24 h-16 sm:w-28 sm:h-[72px] shrink-0 rounded-lg overflow-hidden">
                {article.image ? (
                  <HeroImage
                    src={article.image}
                    alt=""
                    sizes="112px"
                    className="group-hover:scale-105 transition-transform duration-300"
                    fallbackClassName="bg-surface-2"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent/10 to-pixel-cyan/10 flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-accent/60" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                  {article.title}
                </p>
                <div className="flex items-center gap-1.5">
                  {article.publisherFavicon && (
                    <SafeImage
                      src={article.publisherFavicon}
                      alt=""
                      width={12}
                      height={12}
                      className="rounded-sm"
                    />
                  )}
                  <span className="text-[10px] text-tertiary">
                    {article.publisherName}
                  </span>
                </div>
                {/* Related stories pills */}
                {article.related && article.related.length > 0 && (
                  <div className="hidden sm:flex flex-wrap gap-1 pt-0.5">
                    {article.related.slice(0, 2).map((rel) => (
                      <span
                        key={rel.url}
                        className="text-[8px] text-tertiary/70 bg-surface-2 px-1.5 py-0.5 rounded-full border border-border"
                      >
                        {rel.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.a>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="py-16 text-center">
          <Newspaper className="w-12 h-12 text-tertiary mx-auto mb-3" />
          <p className="text-secondary">No articles found.</p>
          {selectedPublisher !== "All" && (
            <button
              onClick={() => setSelectedPublisher("All")}
              className="mt-3 text-xs text-accent hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Attribution */}
      <p className="text-center text-[10px] text-tertiary pt-4">
        News data powered by{" "}
        <a
          href="https://gxcorner.games"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          GX Corner
        </a>
      </p>
    </div>
  );
}
