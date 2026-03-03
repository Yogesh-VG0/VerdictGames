"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FilterChipsProps<T extends string> {
  options: T[];
  selected: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function FilterChips<T extends string>({
  options,
  selected,
  onChange,
  className,
}: FilterChipsProps<T>) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        className
      )}
      role="radiogroup"
    >
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <motion.button
            key={option}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(option)}
            role="radio"
            aria-checked={isActive}
            className={cn(
              "relative px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors duration-150",
              isActive
                ? "bg-accent text-white border-accent"
                : "bg-surface-2 text-secondary border-border hover:border-border-hover hover:text-foreground"
            )}
          >
            {option}
          </motion.button>
        );
      })}
    </div>
  );
}
