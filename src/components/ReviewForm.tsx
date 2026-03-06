"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { submitReview } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import PixelButton from "@/components/ui/PixelButton";

interface ReviewFormProps {
  gameId: string;
  gameSlug: string;
  onAuthRequired: () => void;
  onSuccess?: () => void;
}

const PLATFORMS = ["PC", "Android"] as const;

export default function ReviewForm({ gameId, gameSlug, onAuthRequired, onSuccess }: ReviewFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const [rating, setRating] = useState(75);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [platform, setPlatform] = useState<string>("PC");
  const [prosText, setProsText] = useState("");
  const [consText, setConsText] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: submitReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gameReviews", gameSlug] });
      setIsOpen(false);
      setTitle("");
      setBody("");
      setProsText("");
      setConsText("");
      setRating(75);
      setError("");
      onSuccess?.();
    },
    onError: () => setError("Failed to submit review. Please try again."),
  });

  function handleOpen() {
    if (!user) {
      onAuthRequired();
      return;
    }
    setIsOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Title and review body are required.");
      return;
    }
    setError("");

    const pros = prosText.split("\n").map(s => s.trim()).filter(Boolean);
    const cons = consText.split("\n").map(s => s.trim()).filter(Boolean);

    mutation.mutate({
      gameId,
      rating,
      title: title.trim(),
      bodyText: body.trim(),
      pros: pros.length > 0 ? pros : undefined,
      cons: cons.length > 0 ? cons : undefined,
      platform,
    });
  }

  const scoreColor = rating >= 75 ? "text-score-great" : rating >= 50 ? "text-score-good" : rating >= 25 ? "text-score-mixed" : "text-score-bad";
  const barColor = rating >= 75 ? "accent-great" : rating >= 50 ? "accent-good" : rating >= 25 ? "accent-mixed" : "accent-bad";

  return (
    <div className="space-y-3">
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="w-full py-3 rounded-xl border border-dashed border-accent/30 text-sm font-medium text-accent hover:bg-accent/5 hover:border-accent/50 transition-all"
        >
          ✍️ Write a Review
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">
                Your Review
              </h4>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-tertiary hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Rating Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-secondary font-medium">Rating</label>
                <span className={cn("text-lg font-bold tabular-nums", scoreColor)}>{rating}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className={cn("w-full h-2 rounded-full appearance-none cursor-pointer", `slider-${barColor}`)}
                style={{
                  background: `linear-gradient(to right, var(--vg-accent) ${rating}%, var(--vg-surface-2) ${rating}%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-tertiary">
                <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
              </div>
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <label className="text-xs text-secondary font-medium">Platform</label>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      platform === p
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-white/5 border-white/[0.08] text-secondary hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs text-secondary font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sum up your experience..."
                maxLength={200}
                className="w-full h-10 px-3 text-sm rounded-xl bg-white/5 border border-white/[0.08] text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-xs text-secondary font-medium">Review</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your thoughts..."
                rows={4}
                maxLength={5000}
                className="w-full px-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/[0.08] text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent/50 transition-all resize-y"
              />
            </div>

            {/* Pros & Cons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-success font-medium">+ Pros (one per line)</label>
                <textarea
                  value={prosText}
                  onChange={(e) => setProsText(e.target.value)}
                  placeholder="Great combat&#10;Beautiful graphics"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white/5 border border-success/20 text-foreground placeholder:text-tertiary focus:outline-none focus:border-success/50 transition-all resize-y"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-danger font-medium">− Cons (one per line)</label>
                <textarea
                  value={consText}
                  onChange={(e) => setConsText(e.target.value)}
                  placeholder="Short story&#10;Buggy multiplayer"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white/5 border border-danger/20 text-foreground placeholder:text-tertiary focus:outline-none focus:border-danger/50 transition-all resize-y"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-danger">{error}</p>
            )}

            <div className="flex justify-end">
              <PixelButton type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Submitting..." : "Submit Review"}
              </PixelButton>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
