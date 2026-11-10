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
}: FadeInSectionProps) {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  );
}
