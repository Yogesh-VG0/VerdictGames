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
        "flex gap-2 overflow-x-auto scrollbar-hide pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0",
        className
      )}
      role="radiogroup"
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
              "relative px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 flex items-center gap-1.5",
              isActive
                ? "bg-accent text-white border-accent shadow-[0_0_12px_-3px_rgba(168,85,247,0.4)]"
                : "bg-white/5 text-secondary border-white/10 hover:border-white/20 hover:text-foreground hover:bg-white/10"
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

