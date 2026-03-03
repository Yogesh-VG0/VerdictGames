import Link from "next/link";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}

export default function SectionHeader({
  title,
  href,
  linkLabel = "See all",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full" />
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
