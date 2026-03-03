import Link from "next/link";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  href?: string;
  linkLabel?: string;
  icon?: string;
  subtitle?: string;
  className?: string;
}

export default function SectionHeader({
  title,
  href,
  linkLabel = "See all",
  icon,
  subtitle,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2.5">
          {icon && <span className="text-xl">{icon}</span>}
          <span className="w-1 h-5 bg-accent rounded-full" />
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-xs text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1"
          >
            {linkLabel}
            <span className="text-[10px]">→</span>
          </Link>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-tertiary mt-1.5 ml-[calc(1.25rem+0.625rem+0.25rem+0.625rem)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}
