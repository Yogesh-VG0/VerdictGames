import { VerdictLabel } from "@/lib/types";
import { verdictBgClass } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VerdictBadgeProps {
  label: VerdictLabel;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
  lg: "px-4 py-1.5 text-sm",
};

export default function VerdictBadge({
  label,
  size = "md",
  className,
}: VerdictBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-bold uppercase tracking-widest border rounded-sm",
        verdictBgClass(label),
        sizeStyles[size],
        className
      )}
    >
      {label}
    </span>
  );
}
