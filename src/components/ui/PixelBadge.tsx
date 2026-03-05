import { cn } from "@/lib/utils";

interface PixelBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger" | "muted";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles = {
  default: "bg-surface-2 text-foreground border-border",
  accent: "bg-accent-soft text-accent border-accent/20",
  success: "bg-success/15 text-success border-success/20",
  warning: "bg-warning/15 text-warning border-warning/20",
  danger: "bg-danger/15 text-danger border-danger/20",
  muted: "bg-surface-2 text-secondary border-border",
};

const sizeStyles = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-1 text-xs",
};

export default function PixelBadge({
  children,
  variant = "default",
  size = "sm",
  className,
}: PixelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium uppercase tracking-wider border rounded-full",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
