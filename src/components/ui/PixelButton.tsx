"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type PixelButtonAs = "button" | "span";

type PixelButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  as?: PixelButtonAs;
} & (
  | React.ButtonHTMLAttributes<HTMLButtonElement>
  | React.HTMLAttributes<HTMLSpanElement>
);

const variantStyles = {
  primary:
    "bg-action text-action-foreground border-action hover:bg-action-hover",
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
  as = "button",
  ...props
}: PixelButtonProps) {
  const sharedClassName = cn(
    "relative inline-flex items-center justify-center gap-2 font-medium",
    "rounded-xl border transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
    variantStyles[variant],
    sizeStyles[size],
    className
  );

  if (as === "span") {
    return (
      <span
        className={sharedClassName}
        {...(props as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {children}
      </span>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      className={sharedClassName}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
