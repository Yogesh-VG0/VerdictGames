"use client";

import { cn } from "@/lib/utils";

interface GXServiceBadgeProps {
  name: string;
  color?: string | null;
  className?: string;
}

const SERVICE_STYLES: Record<string, { bg: string; text: string }> = {
  "PS PLUS": { bg: "bg-[#003791]/20 border-[#003791]/30", text: "text-[#4d8edb]" },
  "PS + EXTRA": { bg: "bg-[#003791]/20 border-[#003791]/30", text: "text-[#4d8edb]" },
  "GAMEPASS": { bg: "bg-[#107C10]/20 border-[#107C10]/30", text: "text-[#4ade80]" },
  "PS": { bg: "bg-[#003791]/20 border-[#003791]/30", text: "text-[#4d8edb]" },
};

export default function GXServiceBadge({ name, color, className }: GXServiceBadgeProps) {
  const style = SERVICE_STYLES[name];

  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider",
        style ? `${style.bg} ${style.text}` : "bg-white/5 border-white/10 text-secondary",
        className
      )}
      style={!style && color ? { color, borderColor: `${color}40` } : undefined}
    >
      {name}
    </span>
  );
}
