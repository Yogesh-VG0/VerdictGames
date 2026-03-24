"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Smart pagination with page numbers, ellipsis, manual page input, and responsive design.
 * Shows first/last, prev/next, a window of nearby pages, and a "Go to" input.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const [goToValue, setGoToValue] = useState("");
  const [showGoTo, setShowGoTo] = useState(false);

  if (totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  const handleGoTo = () => {
    const num = parseInt(goToValue, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
      setGoToValue("");
      setShowGoTo(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-2 pt-4", className)}>
      <nav
        aria-label="Pagination"
        className="flex items-center gap-1 sm:gap-1.5"
      >
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          aria-label="First page"
          className={cn(navBtnClass, "hidden sm:flex")}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className={navBtnClass}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pages.map((p, i) =>
            p === "..." ? (
              <button
                key={`ellipsis-${i}`}
                onClick={() => setShowGoTo((v) => !v)}
                className="w-8 h-8 flex items-center justify-center text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer"
                aria-label="Go to page"
                title="Click to jump to a page"
              >
                &hellip;
              </button>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                aria-current={p === currentPage ? "page" : undefined}
                className={cn(
                  "min-w-[2rem] h-8 px-1.5 rounded-lg text-xs font-medium tabular-nums transition-all",
                  p === currentPage
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "text-secondary hover:text-foreground hover:bg-surface-2"
                )}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className={navBtnClass}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="Last page"
          className={cn(navBtnClass, "hidden sm:flex")}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </nav>

      {/* Go-to-page input */}
      {showGoTo && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleGoTo(); }}
          className="flex items-center gap-2 animate-fade-in"
        >
          <span className="text-xs text-secondary">Go to</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={goToValue}
            onChange={(e) => setGoToValue(e.target.value)}
            placeholder={String(currentPage)}
            className="w-20 h-7 px-2 text-xs text-center rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/40 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoFocus
          />
          <span className="text-xs text-tertiary">of {totalPages.toLocaleString()}</span>
          <button
            type="submit"
            className="h-7 px-3 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Go
          </button>
        </form>
      )}
    </div>
  );
}

const navBtnClass =
  "w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:text-foreground hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all";

/**
 * Builds an array of page numbers (and "..." ellipsis markers) to display.
 * Always shows first page, last page, and a window around the current page.
 *
 * Examples (window = 1):
 *   Page 1 of 100  → [1, 2, 3, "...", 100]
 *   Page 5 of 100  → [1, "...", 4, 5, 6, "...", 100]
 *   Page 99 of 100 → [1, "...", 98, 99, 100]
 *   Page 3 of 5    → [1, 2, 3, 4, 5]
 */
function buildPageNumbers(
  current: number,
  total: number,
  window = 1
): (number | "...")[] {
  // If total pages is small enough, show all
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];
  const rangeStart = Math.max(2, current - window);
  const rangeEnd = Math.min(total - 1, current + window);

  // Always show page 1
  pages.push(1);

  // Left ellipsis
  if (rangeStart > 2) {
    pages.push("...");
  } else if (rangeStart === 2) {
    pages.push(2);
  }

  // Window around current page
  for (let i = rangeStart; i <= rangeEnd; i++) {
    if (!pages.includes(i)) pages.push(i);
  }

  // Right ellipsis
  if (rangeEnd < total - 1) {
    pages.push("...");
  } else if (rangeEnd === total - 1) {
    if (!pages.includes(total - 1)) pages.push(total - 1);
  }

  // Always show last page
  if (!pages.includes(total)) pages.push(total);

  return pages;
}
