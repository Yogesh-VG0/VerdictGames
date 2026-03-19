"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { updateLibraryGame, removeFromLibrary, getLibrary } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { LibraryStatus, UserGame } from "@/lib/types";

interface LibraryStatusSelectorProps {
  gameId: string;
  onAuthRequired: () => void;
}

const STATUS_OPTIONS: { value: LibraryStatus; label: string; icon: string }[] = [
  { value: "wishlist", label: "Wishlist", icon: "💫" },
  { value: "playing", label: "Playing", icon: "🎮" },
  { value: "completed", label: "Completed", icon: "✅" },
  { value: "paused", label: "Paused", icon: "⏸️" },
  { value: "dropped", label: "Dropped", icon: "❌" },
];

export default function LibraryStatusSelector({ gameId, onAuthRequired }: LibraryStatusSelectorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; status: LibraryStatus } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if game is in library — use cached library data if available
  const { data: library } = useQuery({
    queryKey: ["library"],
    queryFn: () => getLibrary(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const currentEntry = library?.find((ug) => ug.gameId === gameId);
  const currentStatus = currentEntry?.status;

  const showToast = useCallback((status: LibraryStatus) => {
    const label = STATUS_OPTIONS.find(o => o.value === status)?.label ?? status;
    setToast({ message: `Added to ${label}`, status });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const updateMutation = useMutation({
    mutationFn: (status: LibraryStatus) => updateLibraryGame({ gameId, status }),
    // Optimistic update: immediately update cached library
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: ["library"] });
      const prev = queryClient.getQueryData<UserGame[]>(["library"]);
      queryClient.setQueryData<UserGame[]>(["library"], (old) => {
        if (!old) return old;
        const idx = old.findIndex(ug => ug.gameId === gameId);
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], status: newStatus };
          return updated;
        }
        // New entry — add a placeholder
        return [...old, { id: `optimistic-${gameId}`, userId: "", gameId, status: newStatus, hoursPlayed: 0, notes: "", createdAt: new Date().toISOString() }];
      });
      setOpen(false);
      showToast(newStatus);
      return { prev };
    },
    onError: (_err, _status, context) => {
      if (context?.prev) queryClient.setQueryData(["library"], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["libraryStats"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFromLibrary(gameId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["library"] });
      const prev = queryClient.getQueryData<UserGame[]>(["library"]);
      queryClient.setQueryData<UserGame[]>(["library"], (old) =>
        old ? old.filter(ug => ug.gameId !== gameId) : old
      );
      setOpen(false);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["library"], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["libraryStats"] });
    },
  });

  // Click-outside handler
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleClick() {
    if (!user) {
      onAuthRequired();
      return;
    }
    setOpen(!open);
  }

  const currentOption = currentStatus
    ? STATUS_OPTIONS.find((s) => s.value === currentStatus)
    : null;

  const isPending = updateMutation.isPending || removeMutation.isPending;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 w-full h-11 px-4 rounded-xl text-sm font-medium transition-all border",
          currentStatus
            ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
            : "bg-surface-2 border-border text-foreground hover:border-accent/40 hover:bg-accent/5",
          isPending && "opacity-60 pointer-events-none"
        )}
      >
        <span className="text-base">{currentOption?.icon ?? "+"}</span>
        <span className="flex-1 text-left">
          {currentOption?.label ?? "Add to Library"}
        </span>
        <svg
          className={cn("w-4 h-4 transition-transform", open && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 left-0 right-0 z-50 rounded-xl bg-surface border border-border shadow-2xl overflow-hidden"
          >
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateMutation.mutate(opt.value)}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors",
                  opt.value === currentStatus
                    ? "bg-accent/10 text-accent"
                    : "text-secondary hover:text-foreground hover:bg-surface-2"
                )}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
                {opt.value === currentStatus && (
                  <svg className="w-4 h-4 ml-auto text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
            {currentStatus && (
              <>
                <div className="border-t border-border" />
                <button
                  onClick={() => removeMutation.mutate()}
                  disabled={isPending}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                >
                  <span>🗑️</span>
                  <span>Remove from Library</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-0 right-0 z-50 rounded-xl bg-surface border border-accent/30 shadow-lg px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <span className="text-xs font-medium text-foreground">{toast.message}</span>
            <a
              href={`/library?status=${toast.status}`}
              className="text-[10px] font-semibold text-accent hover:underline whitespace-nowrap"
            >
              View Library
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
