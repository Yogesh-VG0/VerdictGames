"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FadeInSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
}

export default function FadeInSection({
  children,
  className,
  delay = 0,
  direction = "up",
}: FadeInSectionProps) {
  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={cn(className)}
      data-reveal-direction={direction}
    >
      {children}
    </motion.div>
  );
}
