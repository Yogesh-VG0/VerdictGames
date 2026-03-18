"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import ScoreRing from "@/components/ui/ScoreRing";
import VerdictBadge from "@/components/ui/VerdictBadge";
import PlatformIcon from "@/components/ui/PlatformIcon";
import PixelButton from "@/components/ui/PixelButton";

interface QuickViewModalProps {
  game: Game | null;
  onClose: () => void;
}

function yearFromDate(date: string | undefined): string | null {
  if (!date) return null;
  const y = new Date(date).getFullYear();
  return isNaN(y) ? null : String(y);
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/) ||
    url.match(/youtube\.com\/v\/([^&\s?]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function QuickViewModal({ game, onClose }: QuickViewModalProps) {
  useEffect(() => {
    if (!game) return;
    document.body.classList.add("modal-open");
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [game, onClose]);

  if (!game) return null;

  const trailerEmbedUrl = game.trailerUrl ? getYouTubeEmbedUrl(game.trailerUrl) : null;
  const pros = game.pros?.slice(0, 3) ?? [];
  const cons = game.cons?.slice(0, 3) ?? [];
  const releaseYear = yearFromDate(game.releaseDate);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={game.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          aria-hidden
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface",
            "glass-panel"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-col md:flex-row">
            {/* Cover image - top on mobile, left on desktop */}
            <div className="relative w-full md:w-2/5 flex-shrink-0 aspect-[3/4] md:min-h-[320px]">
              {game.coverImage ? (
                <Image
                  src={game.coverImage}
                  alt={game.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none"
                />
              ) : (
                <div className="absolute inset-0 bg-surface-2 flex items-center justify-center rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none">
                  <span className="text-tertiary text-sm font-medium">{game.title.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-6 space-y-4">
              {/* Title, platforms, year */}
              <div>
                <h2 className="text-xl font-bold text-foreground pr-10">{game.title}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {game.platforms.map((p) => (
                    <PlatformIcon key={p} platform={p} size={14} />
                  ))}
                  {releaseYear && (
                    <span className="text-sm text-secondary">{releaseYear}</span>
                  )}
                </div>
              </div>

              {/* ScoreRing + VerdictBadge */}
              <div className="flex items-center gap-4">
                <ScoreRing score={game.score} size={56} strokeWidth={3} />
                <VerdictBadge label={game.verdictLabel} size="md" />
              </div>

              {/* Verdict summary */}
              {game.verdictSummary && (
                <p className="text-sm text-secondary leading-relaxed">{game.verdictSummary}</p>
              )}

              {/* Pros / Cons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pros.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">Pros</h4>
                    <ul className="space-y-1.5">
                      {pros.map((pro, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                          <span className="text-score-great mt-0.5 flex-shrink-0">●</span>
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {cons.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">Cons</h4>
                    <ul className="space-y-1.5">
                      {cons.map((con, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                          <span className="text-score-bad mt-0.5 flex-shrink-0">●</span>
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Trailer embed */}
              {trailerEmbedUrl && (
                <div className="aspect-video rounded-xl overflow-hidden bg-black/40">
                  <iframe
                    src={trailerEmbedUrl}
                    title={`${game.title} trailer`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={`/game/${game.slug}`}>
                  <PixelButton variant="primary" size="md">
                    View Full Verdict
                  </PixelButton>
                </Link>
                <PixelButton variant="secondary" size="md">
                  Add to Library
                </PixelButton>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
