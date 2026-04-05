"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Resilient hero image component.
 * Uses next/image for optimization when the domain is whitelisted.
 * Falls back to a raw <img> tag if next/image fails (e.g. unknown domain).
 * This lets admins set arbitrary header image URLs without breaking the hero.
 */
type HeroImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
  fallback?: ReactNode;
  fallbackClassName?: string;
};

function HeroImageContent({
  src,
  alt,
  priority = false,
  className,
  sizes = "100vw",
  fallback,
  fallbackClassName,
}: HeroImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  if (!src || hasFailed) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent/10 via-surface-2 to-pixel-cyan/10",
          fallbackClassName
        )}
      >
        {fallback ?? <Gamepad2 className="w-8 h-8 text-accent/35" />}
      </div>
    );
  }

  if (useFallback) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={alt}
        className={cn("absolute inset-0 w-full h-full object-cover", className)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setHasFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={cn("object-cover", className)}
      sizes={sizes}
      priority={priority}
      quality={85}
      onError={() => setUseFallback(true)}
    />
  );
}

export default function HeroImage(props: HeroImageProps) {
  return <HeroImageContent key={props.src} {...props} />;
}
