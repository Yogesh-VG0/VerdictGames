"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Smart pagination with page numbers, ellipsis, and responsive design.
 * Shows first/last, prev/next, and a window of nearby pages.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build the list of page numbers to display
  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1 sm:gap-1.5 pt-4", className)}
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
            <span
              key={`ellipsis-${i}`}
              className="w-8 h-8 flex items-center justify-center text-xs text-tertiary select-none"
            >
              &hellip;
            </span>
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
