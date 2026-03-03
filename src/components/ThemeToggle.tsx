"use client";

import { useTheme } from "@/hooks/useTheme";
import { motion } from "framer-motion";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggle}
      className="relative w-9 h-9 rounded-sm border border-border bg-surface-2 flex items-center justify-center text-secondary hover:text-foreground hover:border-border-hover transition-colors"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="text-sm"
      >
        {theme === "dark" ? "☀" : "◐"}
      </motion.span>
    </motion.button>
  );
}
