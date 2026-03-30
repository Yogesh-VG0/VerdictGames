import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import GradientText from "@/components/ui/GradientText";

interface SectionHeaderProps {
  title: string;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
  subtitle?: string;
  className?: string;
  gradient?: string;
  headingTag?: "h1" | "h2" | "h3";
}

export default function SectionHeader({
  title,
  href,
  linkLabel = "View all",
  icon,
  subtitle,
  className,
  gradient,
  headingTag = "h2",
}: SectionHeaderProps) {
  const HeadingTag = headingTag;
  const isPageHeading = headingTag === "h1";

  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <HeadingTag
          className={cn(
            "font-bold text-foreground flex items-center gap-2.5 tracking-tight",
            isPageHeading
              ? "text-3xl sm:text-4xl"
              : headingTag === "h3"
                ? "text-lg md:text-xl"
                : "text-xl md:text-2xl"
          )}
        >
          {icon && <span className="text-accent opacity-80 flex items-center">{icon}</span>}
          {gradient ? (
            <GradientText text={title} gradient={gradient} className="font-bold" />
          ) : (
            title
          )}
        </HeadingTag>
        {href && (
          <Link
            href={href}
            prefetch={false}
            className="text-xs text-accent hover:text-accent-hover font-semibold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap sm:pt-1"
          >
            {linkLabel}
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </Link>
        )}
      </div>
      {subtitle && (
        <p className={cn("text-secondary mt-1.5", isPageHeading ? "text-sm sm:text-base max-w-2xl" : "text-sm")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
