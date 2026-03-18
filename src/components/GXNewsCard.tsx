"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { GXNewsItem } from "@/lib/types";

interface GXNewsCardProps {
  article: GXNewsItem;
}

export default function GXNewsCard({ article }: GXNewsCardProps) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="block group rounded-2xl border border-border bg-surface overflow-hidden card-shimmer hover:border-accent/30 hover:shadow-[0_0_20px_-8px_rgba(168,85,247,0.12)] transition-all duration-500"
    >
      <div className="relative aspect-video overflow-hidden">
        {article.image ? (
          <Image
            src={article.image}
            alt={article.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <span className="text-tertiary text-sm">No Image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      <div className="p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {article.title}
        </h3>

        <div className="flex items-center gap-2">
          {article.publisherFavicon && (
            <Image
              src={article.publisherFavicon}
              alt={article.publisherName}
              width={14}
              height={14}
              className="rounded-sm border border-border"
            />
          )}
          <span className="text-[11px] text-tertiary font-medium">{article.publisherName}</span>
        </div>
      </div>
    </motion.a>
  );
}
