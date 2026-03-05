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
              "relative px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all duration-200",
              isActive
                ? "bg-accent text-white border-accent shadow-[0_0_12px_-3px_rgba(168,85,247,0.4)]"
                : "bg-white/5 text-secondary border-white/10 hover:border-white/20 hover:text-foreground hover:bg-white/10"
            )}
          >
            {option}
          </motion.button>
        );
      })}
    </div>
  );
}
