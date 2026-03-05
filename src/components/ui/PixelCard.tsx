"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  cornerColor?: "accent" | "green" | "cyan" | "orange";
  onClick?: () => void;
}

export default function PixelCard({
  children,
  className,
  hoverEffect = true,
  onClick,
}: PixelCardProps) {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -3 } : undefined}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border border-white/[0.08] bg-surface overflow-hidden",
        hoverEffect && "hover:border-white/[0.15] hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.3)] transition-all duration-300",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
