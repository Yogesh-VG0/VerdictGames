"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { GXDeal } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GXDealCardProps {
  deal: GXDeal;
}

export default function GXDealCard({ deal }: GXDealCardProps) {
  const hasDiscount = deal.discount && deal.discount > 0;

  return (
    <motion.a
      href={deal.buyUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="block group rounded-2xl border border-white/[0.08] bg-surface overflow-hidden card-shimmer hover:border-purple-500/20 hover:shadow-[0_0_30px_-8px_rgba(168,85,247,0.2)] transition-all duration-500"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {deal.cover ? (
          <Image
            src={deal.cover}
            alt={deal.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <span className="text-tertiary text-sm">No Image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

        {hasDiscount && (
          <div className="absolute top-2.5 right-2.5 rounded-xl px-2.5 py-1 bg-pixel-green/90 text-black text-xs font-bold backdrop-blur-md border border-white/10">
            -{deal.discount}%
          </div>
        )}

        {deal.badge && (
          <div className="absolute top-2.5 left-2.5">
            <span className="text-[10px] text-white/90 bg-accent/80 backdrop-blur-md px-2 py-0.5 rounded-lg font-bold border border-white/10 uppercase tracking-wider">
              {deal.badge}
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors">
          {deal.title}
        </h3>

        <div className="flex items-center justify-between">
          {deal.storeName && (
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10",
                "bg-white/5 text-secondary"
              )}
              style={deal.storeColor ? { color: deal.storeColor } : undefined}
            >
              {deal.storeName}
            </span>
          )}
          {deal.price !== null && (
            <span className="text-xs font-bold text-pixel-green">
              {deal.currency ?? "$"}{deal.price.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {deal.genres.slice(0, 2).map((g) => (
            <span key={g} className="text-[10px] text-tertiary font-medium">{g}</span>
          ))}
        </div>
      </div>
    </motion.a>
  );
}
