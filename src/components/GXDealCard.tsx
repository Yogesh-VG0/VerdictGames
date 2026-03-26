"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import type { GXDeal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/utils/slugify";

interface GXDealCardProps {
  deal: GXDeal;
}

export default function GXDealCard({ deal }: GXDealCardProps) {
  const hasDiscount = deal.discount && deal.discount > 0;
  const gameHref = `/game/${slugify(deal.title)}`;
  // Bundle deals go directly to the store — they have no meaningful internal page
  const isBundle = deal.badge?.toLowerCase().includes("bundle") ||
    deal.badge?.toLowerCase().includes("collection") ||
    deal.title.toLowerCase().includes("bundle") ||
    deal.title.toLowerCase().includes("collection") ||
    (deal.badge?.toLowerCase().includes("items"));
  const cardHref = isBundle && deal.buyUrl ? deal.buyUrl : gameHref;
  const isExternal = isBundle && !!deal.buyUrl;

  const CardWrapper = isExternal
    ? ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <a href={cardHref} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
      )
    : ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <Link href={cardHref} className={className}>{children}</Link>
      );

  // Price label for the CTA button
  const priceLabel = deal.price !== null
    ? `${deal.currency ?? "$"}${deal.price.toFixed(2)}`
    : null;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-accent/30 hover:shadow-[0_0_30px_-8px_rgba(168,85,247,0.15)] transition-all duration-500"
    >
      <CardWrapper className="block">
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
      </CardWrapper>

      <div className="p-3.5 space-y-2 flex-1 flex flex-col">
        <CardWrapper
          className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-accent transition-colors"
        >
          {deal.title}
        </CardWrapper>

        <div className="flex items-center justify-between">
          {deal.storeName && (
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-md border border-border",
                "bg-surface-2 text-secondary"
              )}
              style={deal.storeColor ? { color: deal.storeColor } : undefined}
            >
              {deal.storeName}
            </span>
          )}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {deal.genres.slice(0, 2).map((g) => (
              <span key={g} className="text-[10px] text-tertiary font-medium">{g}</span>
            ))}
          </div>
        </div>

        {/* Get Deal CTA — always links to external store */}
        {deal.buyUrl && (
          <a
            href={deal.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200",
              "bg-pixel-green/15 text-pixel-green border border-pixel-green/20",
              "hover:bg-pixel-green hover:text-black hover:border-pixel-green"
            )}
          >
            <ExternalLink className="w-3 h-3" />
            {priceLabel ? `Get Deal · ${priceLabel}` : "Get Deal"}
          </a>
        )}
      </div>
    </motion.div>
  );
}
