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

const cornerMap = {
  accent: "pixel-corners",
  green: "pixel-corners pixel-corners-green",
  cyan: "pixel-corners pixel-corners-cyan",
  orange: "pixel-corners pixel-corners-cyan", // will override
};

export default function PixelCard({
  children,
  className,
  hoverEffect = true,
  cornerColor = "accent",
  onClick,
}: PixelCardProps) {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -2, scale: 1.01 } : undefined}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={onClick}
      className={cn(
        "relative rounded-sm border border-border bg-surface overflow-hidden",
        cornerMap[cornerColor],
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
