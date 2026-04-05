"use client";

import { cn } from "@/lib/utils";
import SafeImage from "@/components/ui/SafeImage";

interface UserAvatarProps {
  src?: string | null;
  displayName?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-7 h-7 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 text-2xl",
};

const PX_MAP = { xs: 24, sm: 28, md: 40, lg: 56, xl: 80 };

export default function UserAvatar({ src, displayName, size = "md", className }: UserAvatarProps) {
  const initial = (displayName ?? "U").charAt(0).toUpperCase();
  const showImage = !!src;

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden border border-accent/30 bg-accent/20 flex items-center justify-center font-bold text-accent",
        SIZE_MAP[size],
        className,
      )}
    >
      {showImage ? (
        <SafeImage
          src={src}
          alt={displayName ?? "User avatar"}
          width={PX_MAP[size]}
          height={PX_MAP[size]}
          className="object-cover w-full h-full"
          unoptimized
          fallback={<span>{initial}</span>}
          fallbackClassName="w-full h-full flex items-center justify-center"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
