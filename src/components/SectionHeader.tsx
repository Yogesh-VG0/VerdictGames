import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
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
    <div className={cn("mb-8", className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5 tracking-tight">
          {icon && <span className="text-accent opacity-80 flex items-center">{icon}</span>}
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-xs text-accent hover:text-accent-hover font-semibold transition-colors flex items-center gap-1.5 shrink-0"
          >
            {linkLabel}
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </Link>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-secondary mt-1.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}
