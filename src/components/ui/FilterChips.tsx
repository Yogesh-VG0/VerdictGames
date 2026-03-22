"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FilterChipsProps<T extends string> {
  options: T[];
  selected: T;
  onChange: (value: T) => void;
  labelFn?: (value: T) => string;
  iconFn?: (value: T) => React.ReactNode | null;
  className?: string;
}

export default function FilterChips<T extends string>({
  options,
  selected,
  onChange,
  labelFn,
  iconFn,
  className,
}: FilterChipsProps<T>) {
  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 sm:flex-wrap sm:pb-0",
        className
      )}
      role="radiogroup"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {options.map((option) => {
        const isActive = option === selected;
        const icon = iconFn ? iconFn(option) : null;
        return (
          <motion.button
            key={option}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(option)}
            role="radio"
            aria-checked={isActive}
            className={cn(
              "relative shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap",
              isActive
                ? "bg-accent text-white border-accent shadow-[0_0_12px_-3px_rgba(168,85,247,0.4)]"
                : "bg-surface-2 text-secondary border-border hover:border-border-hover hover:text-foreground hover:bg-elevated"
            )}
          >
            {icon && <span className="shrink-0">{icon}</span>}
            {labelFn ? labelFn(option) : option}
          </motion.button>
        );
      })}
    </div>
  );
}

