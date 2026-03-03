"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PixelButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantStyles = {
  primary:
    "bg-accent text-white border-accent hover:bg-accent-hover",
  secondary:
    "bg-transparent text-foreground border-border hover:border-accent hover:text-accent",
  ghost:
    "bg-transparent text-secondary border-transparent hover:text-foreground hover:bg-surface-2",
  danger:
    "bg-danger/10 text-danger border-danger/30 hover:bg-danger/20",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function PixelButton({
  variant = "primary",
  size = "md",
  children,
  className,
  ...props
}: PixelButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-medium",
        "rounded-sm border transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-accent",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
