"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { scoreColorVar, cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function ScoreRing({
  score,
  size = 72,
  strokeWidth = 4,
  className,
}: ScoreRingProps) {
  const [mounted, setMounted] = useState(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColorVar(score);

  useEffect(() => setMounted(true), []);

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--vg-border)"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: mounted ? offset : circumference,
          }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      {/* Score label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-lg font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}
