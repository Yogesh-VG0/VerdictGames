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
  label?: string;
}

export default function FilterChips<T extends string>({
  options,
  selected,
  onChange,
  labelFn,
  iconFn,
  className,
  label = 'Filter options',
}: FilterChipsProps<T>) {
  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 sm:flex-wrap sm:pb-0",
        className
      )}
      role="radiogroup"
      aria-label={label}
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
            onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })}
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={event => {
              const index = options.indexOf(option);
              const key = event.key;
              if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
              event.preventDefault();
              const next = key === 'Home' ? 0 : key === 'End' ? options.length - 1
                : (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
              onChange(options[next]);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[next]?.focus();
            }}
            className={cn(
              "relative shrink-0 px-3 py-1.5 text-xs font-medium min-h-9 rounded-xl border transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap",
              isActive
                ? "bg-action text-action-foreground border-action"
                : "bg-surface-2 text-secondary border-control-border hover:border-control-border hover:text-foreground hover:bg-elevated"
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

