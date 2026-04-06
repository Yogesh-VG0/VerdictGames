"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Tag, SlidersHorizontal, Store } from "lucide-react";
import { getGXDeals } from "@/lib/api";
import GXDealCard from "@/components/GXDealCard";
import GXPageNav from "@/components/GXPageNav";
import { GameGridSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

type SortMode = "discount" | "price-low" | "price-high" | "name";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "discount", label: "Biggest Discount" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
  { value: "name", label: "A → Z" },
];

export default function DealsPage() {
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [selectedStore, setSelectedStore] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("discount");

  const { data: deals, isLoading } = useQuery({
    queryKey: ["gx-deals-full"],
    queryFn: () => getGXDeals(),
    staleTime: 60 * 60 * 1000,
  });

  // Extract unique genres and stores from data
  const genres = useMemo(() => {
    if (!deals) return [];
    const set = new Set<string>();
    deals.forEach((d) => d.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [deals]);

  const stores = useMemo(() => {
    if (!deals) return [];
    const set = new Set<string>();
    deals.forEach((d) => { if (d.storeName) set.add(d.storeName); });
    return Array.from(set).sort();
  }, [deals]);

  // Filter and sort
  const filtered = useMemo(() => {
    if (!deals) return [];
    let result = [...deals];

    if (selectedGenre !== "All") {
      result = result.filter((d) => d.genres.includes(selectedGenre));
    }
    if (selectedStore !== "All") {
      result = result.filter((d) => d.storeName === selectedStore);
    }

    switch (sortMode) {
      case "discount":
        result.sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
        break;
      case "price-low":
        result.sort((a, b) => (a.price ?? 999) - (b.price ?? 999));
        break;
      case "price-high":
        result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case "name":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [deals, selectedGenre, selectedStore, sortMode]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 overflow-x-hidden page-enter">
      {/* Quick Nav */}
      <GXPageNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <Tag className="w-7 h-7 text-pixel-green" />
          <span className="bg-gradient-to-r from-pixel-green via-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Game Deals
          </span>
        </h1>
        <p className="text-sm text-secondary mt-1">
          The best discounts from across the web — updated live via GX Corner
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Store filter */}
        {stores.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-tertiary uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" /> Store
            </label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => setSelectedStore("All")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                  selectedStore === "All"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                )}
              >
                All Stores
              </button>
              {stores.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStore(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                    selectedStore === s
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Genre filter */}
        {genres.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-tertiary uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Genre
            </label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => setSelectedGenre("All")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                  selectedGenre === "All"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                )}
              >
                All Genres
              </button>
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                    selectedGenre === g
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-surface-2 text-secondary hover:text-foreground border border-transparent"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sort + count bar */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-tertiary">
            {isLoading ? "Loading deals…" : `${filtered.length} deal${filtered.length !== 1 ? "s" : ""} found`}
          </span>
          <select
            id="deals-page-sort"
            name="sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            aria-label="Sort deals"
            className="text-xs bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-secondary focus:outline-none focus:border-accent/40"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <GameGridSkeleton count={10} columns={5} />
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Tag className="w-12 h-12 text-tertiary mx-auto mb-3" />
          <p className="text-secondary">No deals match your filters.</p>
          <button
            onClick={() => { setSelectedGenre("All"); setSelectedStore("All"); }}
            className="mt-3 text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((deal, i) => (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.4 }}
            >
              <GXDealCard deal={deal} priority={i < 5} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Attribution */}
      <p className="text-center text-[10px] text-tertiary pt-4">
        Deal data powered by <a href="https://gxcorner.games" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GX Corner</a>
      </p>
    </div>
  );
}
